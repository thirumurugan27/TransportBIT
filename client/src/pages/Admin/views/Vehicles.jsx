import React, {useState, useEffect, useRef} from "react";
import {useSearchParams} from "react-router-dom";
import Loading from "../../../components/ui/Loading";
import {showError, showSuccess, showConfirm} from "../../../utils/swal";
import {
  Car,
  Bus,
  Truck,
  Zap,
  Fuel,
  AlertCircle,
  CheckCircle,
  Plus,
  X,
  XCircle,
  Trash2,
  Edit2,
  Search,
  Filter,
  Shield,
  FileCheck,
  FileText,
  Calendar,
  Save,
  ChevronDown,
  Wrench,
  RefreshCw,
  Clock,
  History,
  MessageSquare,
  User,
  Upload,
  Link2,
  CheckCircle2,
  FileSpreadsheet,
  HardDriveUpload,
} from "lucide-react";

import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  apiUpload,
} from "../../../utils/api";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import {
  fetchVehicleTypes,
  toVehicleTypeLabel,
} from "../../../utils/vehicleTypes";

// Parse dd-mm-yyyy date format from backend
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
};

// Helper to calculate days until expiry
const getDaysUntil = (dateStr) => {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = parseDate(dateStr);
  if (!expiry || isNaN(expiry)) return null;
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
};

// Get status color based on days remaining
const getStatusColor = (days) => {
  if (days === null) return "bg-primarybg text-secondarytext";
  if (days < 0) return "bg-red text-secondarybg"; // Expired
  if (days <= 30) return "bg-red/10 text-red"; // Critical
  if (days <= 90) return "bg-pending/10 text-pending"; // Warning
  return "bg-green/10 text-green"; // OK
};

// Display date from backend (already in dd-mm-yyyy format)
const formatDate = (dateStr) => dateStr || "-";

const vehicleTypeIcon = (type) => {
  switch ((type || "").toUpperCase()) {
    case "BUS":
      return Bus;
    case "CAR":
      return Car;
    case "BATTERY_VEHICLE":
      return Zap;
    default:
      return Truck;
  }
};

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toIntegerOrZero = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildVehiclePayload = (source, id = null) => {
  const payload = {
    ...source,
    seating_capacity: toIntegerOrZero(source.seating_capacity),
    insurance_amount: toNullableNumber(source.insurance_amount),
    road_tax_amount: toNullableNumber(source.road_tax_amount),
  };

  if (id !== null && id !== undefined) {
    payload.id = id;
  }

  return payload;
};

const bulkTemplateHeaders = [
  "vehicle_number",
  "vehicle_type",
  "fuel_type",
  "seating_capacity",
  "vehicle_name",
  "start_point",
  "end_point",
  "chassis_number",
  "engine_number",
  "permit_number",
  "additional_permit",
  "insurance_amount",
  "road_tax_amount",
  "pollution_expire",
  "green_tax_expire",
  "mv_tax_expire",
  "insurance_start_date",
  "insurance_expire_date",
  "fc_start_date",
  "fc_expire_date",
  "permit_start_date",
  "permit_expire_date",
];

const bulkTemplateFilePath = "/templates/vehicle_bulk_upload_example.csv";

const getCreatorIdFromToken = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const id = payload?.user_id;
    return typeof id === "number" ? id : null;
  } catch {
    return null;
  }
};

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleTypeOptions, setVehicleTypeOptions] = useState([
    {value: "ALL", label: "All Vehicles", icon: Bus},
  ]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [bulkSheetUrl, setBulkSheetUrl] = useState("");
  const [bulkSourceType, setBulkSourceType] = useState("google");
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkFileSnapshot, setBulkFileSnapshot] = useState(null);
  const [bulkPreview, setBulkPreview] = useState(null);
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
  const [bulkImportLoading, setBulkImportLoading] = useState(false);

  // Filter State
  const [filterType, setFilterType] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState(() => {
    const v = searchParams.get("view");
    return v === "expiry" || v === "mappings" ? v : "fleet";
  });

  // Default driver mapping state (reference-only)
  const [defaultMappings, setDefaultMappings] = useState([]);
  const [mappingDrivers, setMappingDrivers] = useState([]);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [isEditingMapping, setIsEditingMapping] = useState(false);
  const [mappingForm, setMappingForm] = useState({
    id: 0,
    vehicle_id: "",
    driver_id: "",
    notes: "",
  });

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Inline expiry edit state
  const [editingExpiry, setEditingExpiry] = useState(null); // { vehicleId, field }
  const [expiryFormValue, setExpiryFormValue] = useState("");

  // Filter Dropdown
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Detail Modal State
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  // Document Detail Modal State (for expiry table row click)
  const [showDocDetailModal, setShowDocDetailModal] = useState(false);
  const [docDetailVehicle, setDocDetailVehicle] = useState(null);

  // History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyVehicle, setHistoryVehicle] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyGrouped, setHistoryGrouped] = useState({
    insurance: [],
    fc: [],
    permit: [],
  });
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historyLoading, setHistoryLoading] = useState(false);

  // Vehicle Type Management Modal State
  const [showVehicleTypeModal, setShowVehicleTypeModal] = useState(false);
  const [vehicleTypeForm, setVehicleTypeForm] = useState({
    type: "",
    label: "",
  });
  const [isEditingVehicleType, setIsEditingVehicleType] = useState(false);
  const [editingVehicleTypeId, setEditingVehicleTypeId] = useState(null);
  const [isLoadingVehicleType, setIsLoadingVehicleType] = useState(false);

  // Form State
  const initialFormState = {
    vehicle_type: "BUS",
    vehicle_number: "",
    seating_capacity: 0,
    fuel_type: "DIESEL",
    vehicle_name: "",
    start_point: "",
    end_point: "",
    chassis_number: "",
    engine_number: "",
    permit_number: "",
    additional_permit: "",
    insurance_amount: "",
    road_tax_amount: "",
    pollution_expire: "",
    green_tax_expire: "",
    mv_tax_expire: "",
    insurance_expire_date: "",
    insurance_start_date: "",
    fc_expire_date: "",
    fc_start_date: "",
    permit_expire_date: "",
    permit_start_date: "",
    status: "available",
  };
  const [vehicleForm, setVehicleForm] = useState(initialFormState);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/api/admin/vehicles");
      const data = await res.json();
      setVehicles(data || []);
      return data || [];
    } catch (err) {
      console.error("Error fetching vehicles:", err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchTypeOptions = async () => {
    const masterTypes = await fetchVehicleTypes();
    const mapped = [
      {value: "ALL", label: "All Vehicles", icon: Bus},
      ...masterTypes.map((t) => ({
        id: t.id,
        value: t.type,
        label: t.label || toVehicleTypeLabel(t.type),
        icon: vehicleTypeIcon(t.type),
      })),
    ];
    setVehicleTypeOptions(mapped);
  };

  useEffect(() => {
    fetchVehicles();
    fetchTypeOptions();
    fetchDefaultMappings();
    fetchMappingDrivers();
  }, []);

  const fetchDefaultMappings = async () => {
    setMappingLoading(true);
    try {
      const res = await apiGet("/api/admin/default-vehicle-drivers");
      if (!res.ok) {
        setDefaultMappings([]);
        return;
      }
      const data = await res.json();
      setDefaultMappings(data || []);
    } catch (err) {
      console.error("Error fetching default vehicle drivers:", err);
      setDefaultMappings([]);
    } finally {
      setMappingLoading(false);
    }
  };

  const fetchMappingDrivers = async () => {
    try {
      const res = await apiGet("/api/admin/drivers");
      if (!res.ok) {
        setMappingDrivers([]);
        return;
      }
      const data = await res.json();
      setMappingDrivers(data || []);
    } catch (err) {
      console.error("Error fetching mapping drivers:", err);
      setMappingDrivers([]);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowTypeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredVehicles = vehicles.filter((v) => {
    const matchesType = filterType === "ALL" || v.vehicle_type === filterType;
    const matchesSearch =
      v.vehicle_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.vehicle_name &&
        v.vehicle_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const filteredDefaultMappings = defaultMappings.filter((m) => {
    const matchesType = filterType === "ALL" || m.vehicle_type === filterType;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (m.vehicle_name || "").toLowerCase().includes(q) ||
      (m.vehicle_number || "").toLowerCase().includes(q) ||
      (m.vehicle_type || "").toLowerCase().includes(q) ||
      (m.driver_name || "").toLowerCase().includes(q) ||
      (m.driver_phone || "").toLowerCase().includes(q);
    return matchesType && matchesSearch;
  });

  const getVehicleLabel = (v) => {
    if (v.vehicle_name) {
      return v.vehicle_name;
    }
    return v.vehicle_number;
  };

  // Open detail modal
  const openDetailModal = (vehicle) => {
    setSelectedVehicle(vehicle);
    setShowDetailModal(true);
  };

  // Open document detail modal (from expiry table row click)
  const openDocDetailModal = (vehicle) => {
    setDocDetailVehicle(vehicle);
    setShowDocDetailModal(true);
  };

  // Get vehicle type display name
  const getVehicleTypeLabel = (type) => {
    const found = vehicleTypeOptions.find((opt) => opt.value === type);
    return found?.label || toVehicleTypeLabel(type) || type;
  };

  const mappedVehicleIds = new Set(
    defaultMappings
      .filter((m) => (!isEditingMapping ? true : m.id !== mappingForm.id))
      .map((m) => Number(m.vehicle_id)),
  );

  const mappingVehicleOptions = vehicles
    .filter(
      (v) =>
        !mappedVehicleIds.has(v.id) ||
        String(v.id) === String(mappingForm.vehicle_id),
    )
    .map((v) => ({
      value: String(v.id),
      label: v.vehicle_name || v.vehicle_number,
      subtitle: `${v.vehicle_number} • ${getVehicleTypeLabel(v.vehicle_type)}${v.seating_capacity ? ` • ${v.seating_capacity} Seats` : ""}`,
    }));

  const mappingDriverOptions = mappingDrivers.map((d) => ({
    value: String(d.id),
    label: d.full_name || "Driver",
    subtitle: [d.phone, d.license_type ? `License: ${d.license_type}` : null]
      .filter(Boolean)
      .join(" • "),
  }));

  // Convert dd-mm-yyyy from backend to yyyy-mm-dd for HTML date inputs
  const formatDateForInput = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3 && parts[0].length === 2) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  // Normalize backend status for display
  const normalizeStatus = (status) => {
    if (!status) return "available";
    const s = status.toLowerCase().trim();
    if (s === "active") return "active"; // system-managed: assigned/on-trip
    if (s === "available") return "available";
    if (s === "in_service" || s === "maintenance") return "in_service";
    if (s === "not_available" || s === "inactive") return "not_available";
    return "available";
  };

  // For the edit form: "active" is system-managed, so fall back to "available"
  const normalizeFormStatus = (status) => {
    const n = normalizeStatus(status);
    return n === "active" ? "available" : n;
  };

  // Centralized status badge renderer
  const getStatusBadge = (status, opts = {}) => {
    const s = normalizeStatus(status);
    const sz = opts.iconSize ?? 13;
    const extraCls = opts.extraCls ?? "";
    const cfg = {
      active: {
        label: "On Duty",
        cls: "bg-skyblue/10 text-skyblue",
        icon: <Truck size={sz} />,
      },
      available: {
        label: "Available",
        cls: "bg-green/10 text-green",
        icon: <CheckCircle size={sz} />,
      },
      in_service: {
        label: "In Service",
        cls: "bg-pending/10 text-pending",
        icon: <Wrench size={sz} />,
      },
      not_available: {
        label: "Not Available",
        cls: "bg-red/10 text-red",
        icon: <XCircle size={sz} />,
      },
    }[s] ?? {
      label: "Unknown",
      cls: "bg-primarybg text-secondarytext",
      icon: <AlertCircle size={sz} />,
    };
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md ${extraCls} ${cfg.cls}`}
      >
        {cfg.icon}
        {cfg.label}
      </span>
    );
  };

  const handleEdit = (vehicle) => {
    setVehicleForm({
      vehicle_type: vehicle.vehicle_type || "NA",
      vehicle_number: vehicle.vehicle_number || "NA",
      seating_capacity: vehicle.seating_capacity ?? 0,
      fuel_type: vehicle.fuel_type || "NA",
      status: normalizeFormStatus(vehicle.status),
      vehicle_name: vehicle.vehicle_name || "",
      start_point: vehicle.start_point || "",
      end_point: vehicle.end_point || "",
      chassis_number: vehicle.chassis_number || "",
      engine_number: vehicle.engine_number || "",
      permit_number: vehicle.permit_number || "",
      additional_permit: vehicle.additional_permit || "",
      insurance_amount: vehicle.insurance_amount ?? "",
      road_tax_amount: vehicle.road_tax_amount ?? "",
      pollution_expire: formatDateForInput(vehicle.pollution_expire),
      green_tax_expire: formatDateForInput(vehicle.green_tax_expire),
      mv_tax_expire: formatDateForInput(vehicle.mv_tax_expire),
      insurance_expire_date: formatDateForInput(vehicle.insurance_expire_date),
      insurance_start_date: formatDateForInput(vehicle.insurance_start_date),
      fc_expire_date: formatDateForInput(vehicle.fc_expire_date),
      fc_start_date: formatDateForInput(vehicle.fc_start_date),
      permit_expire_date: formatDateForInput(vehicle.permit_expire_date),
      permit_start_date: formatDateForInput(vehicle.permit_start_date),
    });
    setEditingId(vehicle.id);
    setIsEditing(true);
    setShowCreateModal(true);
  };

  const handleDelete = async (id) => {
    const isConfirmed = await showConfirm(
      "Are you sure?",
      "Do you really want to delete this vehicle?",
    );
    if (!isConfirmed) return;
    try {
      const res = await apiDelete(`/api/admin/vehicles/delete?id=${id}`);
      if (res.ok) {
        showSuccess("Success", "Vehicle deleted successfully!");
        fetchVehicles();
      } else {
        showError("Error", "Failed to delete vehicle: " + (await res.text()));
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Error deleting vehicle");
    }
  };

  const openCreateMappingModal = () => {
    setIsEditingMapping(false);
    setMappingForm({
      id: 0,
      vehicle_id: "",
      driver_id: "",
      notes: "",
    });
    setShowMappingModal(true);
  };

  const openEditMappingModal = (mapping) => {
    setIsEditingMapping(true);
    setMappingForm({
      id: mapping.id,
      vehicle_id: String(mapping.vehicle_id),
      driver_id: String(mapping.driver_id),
      notes: mapping.notes || "",
    });
    setShowMappingModal(true);
  };

  const closeMappingModal = () => {
    setShowMappingModal(false);
    setIsEditingMapping(false);
    setMappingForm({
      id: 0,
      vehicle_id: "",
      driver_id: "",
      notes: "",
    });
  };

  const handleSubmitMapping = async () => {
    const vehicleId = Number.parseInt(mappingForm.vehicle_id, 10);
    const driverId = Number.parseInt(mappingForm.driver_id, 10);
    if (!vehicleId || !driverId) {
      showError("Error", "Please select both vehicle and driver");
      return;
    }

    const payload = {
      vehicle_id: vehicleId,
      driver_id: driverId,
      notes: mappingForm.notes?.trim() || null,
      created_by: getCreatorIdFromToken() || undefined,
    };

    try {
      const res = isEditingMapping
        ? await apiPut("/api/admin/default-vehicle-drivers/update", {
            id: mappingForm.id,
            ...payload,
          })
        : await apiPost("/api/admin/default-vehicle-drivers/create", payload);

      if (res.ok) {
        showSuccess(
          "Success",
          isEditingMapping
            ? "Default mapping updated successfully"
            : "Default mapping created successfully",
        );
        closeMappingModal();
        fetchDefaultMappings();
      } else {
        const errorData = await res.json().catch(() => ({}));
        showError(
          "Error",
          errorData.error ||
            `Failed to ${isEditingMapping ? "update" : "create"} mapping`,
        );
      }
    } catch (err) {
      console.error("Error saving default mapping:", err);
      showError("Error", "Error saving default mapping");
    }
  };

  const handleDeleteMapping = async (id) => {
    const isConfirmed = await showConfirm(
      "Are you sure?",
      "Do you really want to delete this default driver mapping?",
    );
    if (!isConfirmed) return;

    try {
      const res = await apiDelete(
        `/api/admin/default-vehicle-drivers/delete?id=${id}`,
      );
      if (res.ok) {
        showSuccess("Success", "Default driver mapping deleted successfully");
        fetchDefaultMappings();
      } else {
        const errorData = await res.json().catch(() => ({}));
        showError("Error", errorData.error || "Failed to delete mapping");
      }
    } catch (err) {
      console.error("Error deleting mapping:", err);
      showError("Error", "Error deleting mapping");
    }
  };

  const handleSubmit = async () => {
    if (
      !vehicleForm.vehicle_type ||
      !vehicleForm.vehicle_number ||
      vehicleForm.seating_capacity === null ||
      vehicleForm.seating_capacity === undefined ||
      vehicleForm.seating_capacity === "" ||
      !vehicleForm.fuel_type
    ) {
      showError("Error", "Please fill all required fields");
      return;
    }
    if (
      vehicleForm.vehicle_type === "BUS" &&
      (!vehicleForm.vehicle_name ||
        !vehicleForm.start_point ||
        !vehicleForm.end_point)
    ) {
      showError(
        "Error",
        "Please fill all bus details (Name, Start/End Points)",
      );
      return;
    }

    try {
      const endpoint = isEditing
        ? "/api/admin/vehicles/update"
        : "/api/admin/vehicles/create";

      const body = isEditing
        ? buildVehiclePayload(vehicleForm, editingId)
        : buildVehiclePayload(vehicleForm);

      const res = await apiPost(endpoint, body);

      if (res.ok) {
        showSuccess(
          "Success",
          isEditing
            ? "Vehicle updated successfully!"
            : "Vehicle created successfully!",
        );
        const freshList = await fetchVehicles();
        // Keep detail modal in sync after an edit
        if (isEditing && editingId && selectedVehicle?.id === editingId) {
          const updated = freshList.find((v) => v.id === editingId);
          if (updated) setSelectedVehicle(updated);
        }
        setShowCreateModal(false);
        setVehicleForm(initialFormState);
        setIsEditing(false);
        setEditingId(null);
      } else {
        showError(
          "Error",
          `Failed to ${isEditing ? "update" : "create"} vehicle: ` +
            (await res.text()),
        );
      }
    } catch (err) {
      console.error(err);
      showError(
        "Error",
        `Error ${isEditing ? "updating" : "creating"} vehicle`,
      );
    }
  };

  const resetBulkUploadState = () => {
    setBulkSourceType("google");
    setBulkSheetUrl("");
    setBulkFile(null);
    setBulkFileSnapshot(null);
    setBulkPreview(null);
    setBulkPreviewLoading(false);
    setBulkImportLoading(false);
  };

  const closeBulkUploadModal = () => {
    setShowBulkUploadModal(false);
    resetBulkUploadState();
  };

  // Vehicle Type Management Handlers
  const handleVehicleTypeSubmit = async () => {
    if (!vehicleTypeForm.type.trim() || !vehicleTypeForm.label.trim()) {
      showError("Error", "Please fill all fields");
      return;
    }

    setIsLoadingVehicleType(true);
    try {
      let res;
      if (isEditingVehicleType) {
        res = await apiPut(
          `/api/admin/vehicle-types/${editingVehicleTypeId}`,
          vehicleTypeForm,
        );
      } else {
        res = await apiPost("/api/admin/vehicle-types/create", vehicleTypeForm);
      }

      if (res.ok) {
        showSuccess(
          "Success",
          isEditingVehicleType
            ? "Vehicle type updated successfully!"
            : "Vehicle type created successfully!",
        );
        await fetchTypeOptions();
        setVehicleTypeForm({type: "", label: ""});
        setIsEditingVehicleType(false);
        setEditingVehicleTypeId(null);
        setShowVehicleTypeModal(false);
      } else {
        const error = await res.text();
        showError("Error", error || "Failed to save vehicle type");
      }
    } catch (err) {
      console.error(err);
      showError("Error", "An error occurred");
    } finally {
      setIsLoadingVehicleType(false);
    }
  };

  const handleDeleteVehicleType = async (typeId) => {
    showConfirm(
      "Delete Vehicle Type",
      "Are you sure? This action cannot be undone.",
      async () => {
        try {
          const res = await apiDelete(`/api/admin/vehicle-types/${typeId}`);
          if (res.ok) {
            showSuccess("Success", "Vehicle type deleted successfully");
            await fetchTypeOptions();
          } else {
            const error = await res.text();
            showError("Error", error || "Failed to delete vehicle type");
          }
        } catch (err) {
          console.error(err);
          showError("Error", "An error occurred");
        }
      },
    );
  };

  const openEditVehicleType = (type) => {
    setVehicleTypeForm({
      type: type.type,
      label: type.label,
    });
    setIsEditingVehicleType(true);
    setEditingVehicleTypeId(type.id);
    setShowVehicleTypeModal(true);
  };

  const closeVehicleTypeModal = () => {
    setShowVehicleTypeModal(false);
    setVehicleTypeForm({type: "", label: ""});
    setIsEditingVehicleType(false);
    setEditingVehicleTypeId(null);
  };

  const handleCopyTemplateHeaders = async () => {
    try {
      if (!navigator?.clipboard) {
        showError("Error", "Clipboard is not available in this browser");
        return;
      }
      await navigator.clipboard.writeText(bulkTemplateHeaders.join(","));
      showSuccess("Success", "Template headers copied");
    } catch (error) {
      console.error(error);
      showError("Error", "Failed to copy template headers");
    }
  };

  const handleBulkFileChange = async (event) => {
    const selectedFile = event.target.files?.[0] || null;
    if (!selectedFile) {
      setBulkFile(null);
      setBulkFileSnapshot(null);
      setBulkPreview(null);
      return;
    }

    // Snapshot file content in memory so browser-side file change watchers
    // do not break uploads with ERR_UPLOAD_FILE_CHANGED.
    try {
      const fileBuffer = await selectedFile.arrayBuffer();
      const fileSnapshot = new File([fileBuffer], selectedFile.name, {
        type: selectedFile.type,
        lastModified: selectedFile.lastModified,
      });
      setBulkFile(selectedFile);
      setBulkFileSnapshot(fileSnapshot);
    } catch (error) {
      console.error(error);
      setBulkFile(null);
      setBulkFileSnapshot(null);
      showError("Error", "Unable to read selected file. Please choose again.");
    }

    setBulkPreview(null);
  };

  const handleBulkPreviewGoogle = async () => {
    const sheetUrl = bulkSheetUrl.trim();
    if (!sheetUrl) {
      showError("Error", "Paste a Google Sheet URL to continue");
      return;
    }

    setBulkPreviewLoading(true);
    try {
      const res = await apiPost("/api/admin/vehicles/bulk-preview", {
        sheet_url: sheetUrl,
      });
      const data = await res.json();

      if (!res.ok) {
        setBulkPreview(data.preview || null);
        showError("Error", data.error || "Unable to validate the sheet");
        return;
      }

      setBulkPreview(data);
      if (data.invalid_rows > 0) {
        showError(
          "Validation",
          `${data.invalid_rows} row(s) need attention before import`,
        );
      } else {
        showSuccess(
          "Validation",
          `${data.ready_rows} row(s) are ready to import`,
        );
      }
    } catch (error) {
      console.error(error);
      setBulkPreview(null);
      showError("Error", "Unable to validate Google Sheet");
    } finally {
      setBulkPreviewLoading(false);
    }
  };

  const handleBulkPreviewFile = async () => {
    if (!bulkFile) {
      showError("Error", "Choose an Excel or CSV file to continue");
      return;
    }

    const uploadFile = bulkFileSnapshot || bulkFile;
    const formData = new FormData();
    formData.append("file", uploadFile);

    setBulkPreviewLoading(true);
    try {
      const res = await apiUpload(
        "/api/admin/vehicles/bulk-preview-file",
        formData,
      );
      const data = await res.json();

      if (!res.ok) {
        setBulkPreview(data.preview || null);
        showError("Error", data.error || "Unable to validate file");
        return;
      }

      setBulkPreview(data);
      if (data.invalid_rows > 0) {
        showError(
          "Validation",
          `${data.invalid_rows} row(s) need attention before import`,
        );
      } else {
        showSuccess(
          "Validation",
          `${data.ready_rows} row(s) are ready to import`,
        );
      }
    } catch (error) {
      console.error(error);
      setBulkPreview(null);
      if (error instanceof TypeError) {
        showError(
          "Error",
          "Selected file changed during upload. Please reselect the file and try again.",
        );
      } else {
        showError("Error", "Unable to validate file");
      }
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
      showError("Error", "Paste a Google Sheet URL to continue");
      return;
    }

    setBulkImportLoading(true);
    try {
      const res = await apiPost("/api/admin/vehicles/bulk-import", {
        sheet_url: sheetUrl,
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.preview) {
          setBulkPreview(data.preview);
        }
        showError("Error", data.error || "Bulk import failed");
        return;
      }

      showSuccess("Success", data.message || "Vehicles imported successfully");
      fetchVehicles();
      closeBulkUploadModal();
    } catch (error) {
      console.error(error);
      showError("Error", "Google Sheet import failed");
    } finally {
      setBulkImportLoading(false);
    }
  };

  const handleBulkImportFile = async () => {
    if (!bulkFile) {
      showError("Error", "Choose an Excel or CSV file to continue");
      return;
    }

    const uploadFile = bulkFileSnapshot || bulkFile;
    const formData = new FormData();
    formData.append("file", uploadFile);

    setBulkImportLoading(true);
    try {
      const res = await apiUpload(
        "/api/admin/vehicles/bulk-import-file",
        formData,
      );
      const data = await res.json();

      if (!res.ok) {
        if (data.preview) {
          setBulkPreview(data.preview);
        }
        showError("Error", data.error || "File import failed");
        return;
      }

      showSuccess("Success", data.message || "Vehicles imported successfully");
      fetchVehicles();
      closeBulkUploadModal();
    } catch (error) {
      console.error(error);
      if (error instanceof TypeError) {
        showError(
          "Error",
          "Selected file changed during upload. Please reselect the file and try again.",
        );
      } else {
        showError("Error", "File import failed");
      }
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

  // Helper to format date for API (convert dd-mm-yyyy to yyyy-mm-dd)
  const formatDateForAPI = (dateStr) => {
    if (!dateStr) return null;
    return formatDateForInput(dateStr);
  };

  // Handle inline expiry date update
  const handleExpiryClick = (vehicle, field) => {
    setEditingExpiry({vehicleId: vehicle.id, field});
    const dateValue = vehicle[field];
    if (dateValue) {
      setExpiryFormValue(formatDateForInput(dateValue));
    } else {
      setExpiryFormValue("");
    }
  };

  const handleExpiryUpdate = async () => {
    if (!editingExpiry) return;

    const vehicle = vehicles.find((v) => v.id === editingExpiry.vehicleId);
    if (!vehicle) return;

    // Format all dates to YYYY-MM-DD
    const updatedVehicle = buildVehiclePayload({
      id: vehicle.id,
      vehicle_name: vehicle.vehicle_name || "",
      vehicle_number: vehicle.vehicle_number,
      vehicle_type: vehicle.vehicle_type,
      fuel_type: vehicle.fuel_type,
      seating_capacity: vehicle.seating_capacity,
      status: vehicle.status,
      insurance_expire_date: formatDateForAPI(vehicle.insurance_expire_date),
      insurance_start_date: formatDateForAPI(vehicle.insurance_start_date),
      fc_expire_date: formatDateForAPI(vehicle.fc_expire_date),
      fc_start_date: formatDateForAPI(vehicle.fc_start_date),
      permit_expire_date: formatDateForAPI(vehicle.permit_expire_date),
      permit_start_date: formatDateForAPI(vehicle.permit_start_date),
      [editingExpiry.field]: expiryFormValue || null,
    });

    try {
      const res = await apiPost("/api/admin/vehicles/update", updatedVehicle);

      if (res.ok) {
        fetchVehicles();
        setEditingExpiry(null);
        setExpiryFormValue("");
      } else {
        showError(
          "Error",
          "Failed to update expiry date: " + (await res.text()),
        );
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Error updating expiry date");
    }
  };

  const cancelExpiryEdit = () => {
    setEditingExpiry(null);
    setExpiryFormValue("");
  };

  // Fetch document history for a specific vehicle
  const fetchDocumentHistory = async (vehicle) => {
    setHistoryVehicle(vehicle);
    setHistoryLoading(true);
    setShowHistoryModal(true);
    setHistoryFilter("all");
    try {
      const res = await apiGet(
        `/api/admin/vehicles/${vehicle.id}/document-history`,
      );
      if (res.ok) {
        const data = await res.json();
        setHistoryLogs(data.logs || []);
        setHistoryGrouped(data.grouped || {insurance: [], fc: [], permit: []});
      } else {
        setHistoryLogs([]);
        setHistoryGrouped({insurance: [], fc: [], permit: []});
      }
    } catch (err) {
      console.error("Error fetching document history:", err);
      setHistoryLogs([]);
      setHistoryGrouped({insurance: [], fc: [], permit: []});
    } finally {
      setHistoryLoading(false);
    }
  };

  // Get filtered history logs based on selected filter tab
  const getFilteredHistoryLogs = () => {
    if (historyFilter === "all") return historyLogs;
    return historyGrouped[historyFilter] || [];
  };

  // Format field name for display
  const formatFieldName = (fieldName) => {
    switch (fieldName) {
      case "start_date":
        return "Start Date";
      case "expire_date":
        return "Expiry Date";
      case "remarks":
        return "Remarks";
      default:
        return fieldName;
    }
  };

  // Format document type for display
  const formatDocType = (docType) => {
    switch (docType) {
      case "insurance":
        return "Insurance";
      case "fc":
        return "FC";
      case "permit":
        return "Permit";
      default:
        return docType;
    }
  };

  // Get doc type color
  const getDocTypeColor = (docType) => {
    switch (docType) {
      case "insurance":
        return "bg-skyblue/10 text-skyblue";
      case "fc":
        return "bg-green/10 text-green";
      case "permit":
        return "bg-primary/10 text-primary";
      default:
        return "bg-primarybg text-secondarytext";
    }
  };

  // Group history logs by date (changed_at format: "dd-mm-yyyy HH:MM:SS")
  const groupLogsByDate = (logs) => {
    const groups = {};
    logs.forEach((log) => {
      const datePart = log.changed_at
        ? log.changed_at.split(" ")[0]
        : "Unknown";
      if (!groups[datePart]) groups[datePart] = [];
      groups[datePart].push(log);
    });
    return Object.entries(groups).map(([date, items]) => ({date, items}));
  };

  // Format "dd-mm-yyyy" → "04 Mar 2026"
  const formatGroupDate = (dateStr) => {
    const MONTHS = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!match) return dateStr;
    const [, d, m, y] = match;
    return `${d} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
  };

  // Get expiry stats
  const getExpiryStats = () => {
    let insuranceExpired = 0,
      insuranceCritical = 0;
    let fcExpired = 0,
      fcCritical = 0;
    let permitExpired = 0,
      permitCritical = 0;
    let pollutionExpired = 0,
      pollutionCritical = 0;
    let greenTaxExpired = 0,
      greenTaxCritical = 0;
    let mvTaxExpired = 0,
      mvTaxCritical = 0;

    vehicles.forEach((v) => {
      const insDays = getDaysUntil(v.insurance_expire_date);
      const fcDays = getDaysUntil(v.fc_expire_date);
      const permitDays = getDaysUntil(v.permit_expire_date);
      const pollutionDays = getDaysUntil(v.pollution_expire);
      const greenTaxDays = getDaysUntil(v.green_tax_expire);
      const mvTaxDays = getDaysUntil(v.mv_tax_expire);

      if (insDays !== null) {
        if (insDays < 0) insuranceExpired++;
        else if (insDays <= 30) insuranceCritical++;
      }
      if (fcDays !== null) {
        if (fcDays < 0) fcExpired++;
        else if (fcDays <= 30) fcCritical++;
      }
      if (permitDays !== null) {
        if (permitDays < 0) permitExpired++;
        else if (permitDays <= 30) permitCritical++;
      }
      if (pollutionDays !== null) {
        if (pollutionDays < 0) pollutionExpired++;
        else if (pollutionDays <= 30) pollutionCritical++;
      }
      if (greenTaxDays !== null) {
        if (greenTaxDays < 0) greenTaxExpired++;
        else if (greenTaxDays <= 30) greenTaxCritical++;
      }
      if (mvTaxDays !== null) {
        if (mvTaxDays < 0) mvTaxExpired++;
        else if (mvTaxDays <= 30) mvTaxCritical++;
      }
    });

    return {
      insurance: {expired: insuranceExpired, critical: insuranceCritical},
      fc: {expired: fcExpired, critical: fcCritical},
      permit: {expired: permitExpired, critical: permitCritical},
      pollution: {expired: pollutionExpired, critical: pollutionCritical},
      greenTax: {expired: greenTaxExpired, critical: greenTaxCritical},
      mvTax: {expired: mvTaxExpired, critical: mvTaxCritical},
    };
  };

  const expiryStats = getExpiryStats();

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* View Mode Toggle */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 bg-secondarybg rounded-md border border-primary/10 p-1.5 gap-1 w-full xl:max-w-4xl">
          <button
            onClick={() => setViewMode("fleet")}
            className={`w-full px-4 sm:px-5 py-3 rounded-md text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 text-center ${
              viewMode === "fleet"
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext hover:bg-primary/5 hover:text-primary"
            }`}
          >
            <Bus size={16} /> Fleet View
          </button>
          <button
            onClick={() => setViewMode("expiry")}
            className={`w-full px-4 sm:px-5 py-3 rounded-md text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 text-center ${
              viewMode === "expiry"
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext hover:bg-primary/5 hover:text-primary"
            }`}
          >
            <Shield size={16} /> Documents Details
            {expiryStats.insurance.expired +
              expiryStats.fc.expired +
              expiryStats.permit.expired +
              expiryStats.pollution.expired +
              expiryStats.greenTax.expired +
              expiryStats.mvTax.expired >
              0 && (
              <span className="ml-1 px-2 py-0.5 bg-red text-white text-xs rounded-md font-bold">
                {expiryStats.insurance.expired +
                  expiryStats.fc.expired +
                  expiryStats.permit.expired +
                  expiryStats.pollution.expired +
                  expiryStats.greenTax.expired +
                  expiryStats.mvTax.expired}
              </span>
            )}
          </button>
          <button
            onClick={() => setViewMode("mappings")}
            className={`w-full px-4 sm:px-5 py-3 rounded-md text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 text-center ${
              viewMode === "mappings"
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext hover:bg-primary/5 hover:text-primary"
            }`}
          >
            <User size={16} />
            Driver Mapping
          </button>
        </div>
        <div className="flex w-full flex-col sm:flex-row sm:justify-end items-stretch sm:items-center gap-3">
          {viewMode === "mappings" ? (
            <button
              onClick={openCreateMappingModal}
              className="w-full sm:w-auto justify-center flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-md hover:bg-primarydull transition-all font-semibold shadow-sm hover:shadow-md"
            >
              <Plus size={18} />
              Add Default Mapping
            </button>
          ) : (
            <>
              <button
                onClick={() => setShowBulkUploadModal(true)}
                className="w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-3 border border-primary/25 text-primary rounded-md hover:bg-primary/10 transition-all font-semibold"
              >
                <HardDriveUpload size={18} />
                Bulk Upload
              </button>
              {/* <button
                onClick={() => setShowVehicleTypeModal(true)}
                className="w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-3 border border-primary/25 text-primary rounded-md hover:bg-primary/10 transition-all font-semibold"
              >
                <Truck size={18} />
                Manage Types
              </button> */}
              <button
                onClick={() => {
                  setIsEditing(false);
                  setVehicleForm(initialFormState);
                  setShowCreateModal(true);
                }}
                className="w-full sm:w-auto justify-center flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-md hover:bg-primarydull transition-all font-semibold shadow-sm hover:shadow-md"
              >
                <Plus size={18} />
                Add New Vehicle
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats Section */}
      {viewMode === "fleet" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
          <div className="bg-secondarybg rounded-md p-3 sm:p-4 border border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.08em] text-secondarytext mb-0.5">
                  Total Vehicles
                </p>
                <h3 className="text-xl sm:text-2xl font-semibold text-slate-700 leading-tight">
                  {vehicles?.length || 0}
                </h3>
              </div>
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center shrink-0">
                <Bus className="w-6 h-6 text-primary" strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <div className="bg-secondarybg rounded-md p-3 sm:p-4 border border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.08em] text-secondarytext mb-0.5">
                  Buses
                </p>
                <h3 className="text-xl sm:text-2xl font-semibold text-slate-700 leading-tight">
                  {vehicles?.filter((v) => v.vehicle_type === "BUS").length ||
                    0}
                </h3>
              </div>
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center shrink-0">
                <Bus className="w-6 h-6 text-primary" strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <div className="bg-secondarybg rounded-md p-3 sm:p-4 border border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.08em] text-secondarytext mb-0.5">
                  Cars
                </p>
                <h3 className="text-xl sm:text-2xl font-semibold text-slate-700 leading-tight">
                  {vehicles?.filter((v) => v.vehicle_type === "CAR").length ||
                    0}
                </h3>
              </div>
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center shrink-0">
                <Car className="w-6 h-6 text-green" strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <div className="bg-secondarybg rounded-md p-3 sm:p-4 border border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.08em] text-secondarytext mb-0.5">
                  Battery Vehicles
                </p>
                <h3 className="text-xl sm:text-2xl font-semibold text-slate-700 leading-tight">
                  {vehicles?.filter((v) => v.vehicle_type === "BATTERY_VEHICLE")
                    .length || 0}
                </h3>
              </div>
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center shrink-0">
                <Zap className="w-6 h-6 text-pending" strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <div className="bg-secondarybg rounded-md p-3 sm:p-4 border border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.08em] text-secondarytext mb-0.5">
                  Others
                </p>
                <h3 className="text-xl sm:text-2xl font-semibold text-slate-700 leading-tight">
                  {vehicles?.filter((v) => v.vehicle_type === "OTHER").length ||
                    0}
                </h3>
              </div>
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center shrink-0">
                <Truck
                  className="w-6 h-6 text-secondarytext"
                  strokeWidth={2.5}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Header - REMOVED */}

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-secondarytext"
            size={18}
          />
          <input
            type="text"
            placeholder={
              viewMode === "mappings"
                ? "Search by vehicle, type, driver, or phone..."
                : "Search by vehicle number or bus name..."
            }
            className="w-full pl-12 pr-4 py-3 bg-secondarybg border border-primary/10 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-primarytext placeholder:text-secondarytext/60 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="relative w-full lg:w-auto" ref={dropdownRef}>
          <button
            onClick={() => setShowTypeDropdown(!showTypeDropdown)}
            className="w-full md:min-w-52 flex items-center gap-3 px-4 py-3 bg-secondarybg border border-primary/10 rounded-md hover:border-primary/30 transition-all text-sm"
          >
            {(() => {
              const opt = vehicleTypeOptions.find(
                (t) => t.value === filterType,
              );
              const Icon = opt?.icon || Bus;
              return (
                <>
                  <Icon size={16} className="text-primary" />
                  <span className="font-medium text-primarytext">
                    {opt?.label || "All Vehicles"}
                  </span>
                </>
              );
            })()}
            <ChevronDown
              size={16}
              className={`text-secondarytext ml-auto transition-transform duration-200 ${
                showTypeDropdown ? "rotate-180" : ""
              }`}
            />
          </button>

          {showTypeDropdown && (
            <div className="absolute top-full left-0 mt-1.5 w-full bg-secondarybg border border-primary/10 rounded-md shadow-lg z-30 py-1 animate-fadeIn">
              {vehicleTypeOptions.map((type) => {
                const Icon = type.icon;
                const count =
                  type.value === "ALL"
                    ? vehicles.length
                    : vehicles.filter((v) => v.vehicle_type === type.value)
                        .length;
                return (
                  <button
                    key={type.value}
                    onClick={() => {
                      setFilterType(type.value);
                      setShowTypeDropdown(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      filterType === type.value
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-primarytext hover:bg-primarybg"
                    }`}
                  >
                    <Icon size={16} />
                    <span className="flex-1 text-left">{type.label}</span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                        filterType === type.value
                          ? "bg-primary/20 text-primary"
                          : "bg-primarybg text-secondarytext"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Expiry Status View */}
      {viewMode === "expiry" && (
        <>
          {/* Expiry Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
            {[
              {
                key: "insurance",
                label: "Insurance",
                icon: Shield,
                color: "skyblue",
                stats: expiryStats.insurance,
              },
              {
                key: "fc",
                label: "FC (Fitness Certificate)",
                icon: FileCheck,
                color: "green",
                stats: expiryStats.fc,
              },
              {
                key: "permit",
                label: "Permit",
                icon: FileText,
                color: "primary",
                stats: expiryStats.permit,
              },
              {
                key: "pollution",
                label: "Pollution (PUC)",
                icon: AlertCircle,
                color: "pending",
                stats: expiryStats.pollution,
              },
              {
                key: "greenTax",
                label: "Green Tax",
                icon: RefreshCw,
                color: "green",
                stats: expiryStats.greenTax,
              },
              {
                key: "mvTax",
                label: "MV Tax",
                icon: FileText,
                color: "primary",
                stats: expiryStats.mvTax,
              },
            ].map((doc) => {
              const Icon = doc.icon;
              const hasIssues = doc.stats.expired > 0 || doc.stats.critical > 0;
              const colorClasses = {
                skyblue: "text-skyblue",
                green: "text-green",
                primary: "text-primary",
                pending: "text-pending",
              };
              return (
                <div
                  key={doc.key}
                  className="bg-secondarybg rounded-md p-3 sm:p-4 border border-gray-100"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.08em] text-secondarytext mb-0.5">
                        {doc.label}
                      </p>
                      <div className="flex items-end gap-2">
                        <span
                          className={`text-xl sm:text-2xl font-semibold leading-tight ${hasIssues ? "text-red" : "text-slate-700"}`}
                        >
                          {doc.stats.expired + doc.stats.critical}
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-semibold text-secondarytext pb-1">
                          {doc.stats.expired > 0 ? "expired" : "critical"}
                        </span>
                      </div>
                    </div>
                    <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center shrink-0">
                      <Icon
                        className={`w-6 h-6 ${colorClasses[doc.color] || colorClasses.primary}`}
                        strokeWidth={2.5}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Expiry Table */}
          <div className="bg-secondarybg rounded-md shadow-sm border border-primary/10 overflow-hidden">
            <div className="px-6 py-3 border-b border-primary/5 bg-primarybg/50 flex items-center justify-between">
              <p className="text-sm text-secondarytext">
                Click on a row to view full document details, edit, or see
                change history.
              </p>
              <span className="text-xs text-secondarytext bg-primarybg px-3 py-1 rounded-md">
                {filteredVehicles.length} vehicles
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-245">
                <thead className="bg-primarybg/50 border-b border-primary/5">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider w-10">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Vehicle
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-1">
                        <Shield size={12} /> Insurance
                      </div>
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-1">
                        <FileCheck size={12} /> FC
                      </div>
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-1">
                        <FileText size={12} /> Permit
                      </div>
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-1">
                        <AlertCircle size={12} /> Pollution
                      </div>
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-1">
                        <RefreshCw size={12} /> Green Tax
                      </div>
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-1">
                        <FileText size={12} /> MV Tax
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {filteredVehicles && filteredVehicles.length > 0 ? (
                    [...filteredVehicles]
                      .sort((a, b) => {
                        const aMin = Math.min(
                          getDaysUntil(a.insurance_expire_date) ?? 9999,
                          getDaysUntil(a.fc_expire_date) ?? 9999,
                          getDaysUntil(a.permit_expire_date) ?? 9999,
                          getDaysUntil(a.pollution_expire) ?? 9999,
                          getDaysUntil(a.green_tax_expire) ?? 9999,
                          getDaysUntil(a.mv_tax_expire) ?? 9999,
                        );
                        const bMin = Math.min(
                          getDaysUntil(b.insurance_expire_date) ?? 9999,
                          getDaysUntil(b.fc_expire_date) ?? 9999,
                          getDaysUntil(b.permit_expire_date) ?? 9999,
                          getDaysUntil(b.pollution_expire) ?? 9999,
                          getDaysUntil(b.green_tax_expire) ?? 9999,
                          getDaysUntil(b.mv_tax_expire) ?? 9999,
                        );
                        return aMin - bMin;
                      })
                      .map((v, idx) => {
                        const insDays = getDaysUntil(v.insurance_expire_date);
                        const fcDays = getDaysUntil(v.fc_expire_date);
                        const permitDays = getDaysUntil(v.permit_expire_date);
                        const pollutionDays = getDaysUntil(v.pollution_expire);
                        const greenTaxDays = getDaysUntil(v.green_tax_expire);
                        const mvTaxDays = getDaysUntil(v.mv_tax_expire);

                        // Render expiry date + days badge (table cell)
                        const renderExpiryCell = (expireDate, days) => (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs font-medium text-primarytext">
                              {expireDate || (
                                <span className="text-secondarytext/40 italic">
                                  Not set
                                </span>
                              )}
                            </span>
                            {days !== null && (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${getStatusColor(days)}`}
                              >
                                {days < 0
                                  ? `${Math.abs(days)}d overdue`
                                  : `${days}d left`}
                              </span>
                            )}
                          </div>
                        );

                        return (
                          <tr
                            key={v.id}
                            onClick={() => openDocDetailModal(v)}
                            className="hover:bg-primarybg/50 transition-colors cursor-pointer group"
                          >
                            <td className="px-3 py-3 text-sm text-secondarytext font-medium">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {v.vehicle_type === "BUS" ? (
                                  <Bus size={15} className="text-primary" />
                                ) : v.vehicle_type === "CAR" ? (
                                  <Car size={15} className="text-green" />
                                ) : v.vehicle_type === "BATTERY_VEHICLE" ? (
                                  <Zap size={15} className="text-pending" />
                                ) : (
                                  <Truck
                                    size={15}
                                    className="text-secondarytext"
                                  />
                                )}
                                <div>
                                  <span className="font-semibold text-primarytext text-sm group-hover:text-primary transition-colors">
                                    {v.vehicle_name || v.vehicle_number}
                                  </span>
                                  <p className="text-[10px] text-secondarytext font-mono">
                                    {v.vehicle_number}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-3 py-3 text-center">
                              {renderExpiryCell(
                                formatDate(v.insurance_expire_date),
                                insDays,
                              )}
                            </td>

                            <td className="px-3 py-3 text-center">
                              {renderExpiryCell(
                                formatDate(v.fc_expire_date),
                                fcDays,
                              )}
                            </td>

                            <td className="px-3 py-3 text-center">
                              {renderExpiryCell(
                                formatDate(v.permit_expire_date),
                                permitDays,
                              )}
                            </td>

                            <td className="px-3 py-3 text-center">
                              {renderExpiryCell(
                                formatDate(v.pollution_expire),
                                pollutionDays,
                              )}
                            </td>

                            <td className="px-3 py-3 text-center">
                              {renderExpiryCell(
                                formatDate(v.green_tax_expire),
                                greenTaxDays,
                              )}
                            </td>

                            <td className="px-3 py-3 text-center">
                              {renderExpiryCell(
                                formatDate(v.mv_tax_expire),
                                mvTaxDays,
                              )}
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td
                        colSpan="8"
                        className="px-6 py-12 text-center text-secondarytext"
                      >
                        No vehicles found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Default Driver Mapping View */}
      {viewMode === "mappings" && (
        <div className="bg-secondarybg rounded-md shadow-sm border border-primary/10 overflow-hidden">
          {mappingLoading ? (
            <Loading
              fullScreen={false}
              text="Loading default driver mappings..."
            />
          ) : (
            <>
              <div className="px-6 py-4 border-b border-primary/5 bg-linear-to-r from-primarybg/70 to-secondarybg flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <User size={18} />
                  </div>
                  <h3 className="text-base font-bold text-primarytext">
                    Default Driver Mapping
                  </h3>
                </div>
                <div className="flex items-center gap-2 self-start lg:self-auto">
                  <span className="text-xs text-secondarytext bg-primarybg px-3 py-1.5 rounded-md font-medium">
                    {filteredDefaultMappings.length} mappings
                  </span>
                  <span className="text-xs text-secondarytext bg-secondarybg border border-primary/10 px-3 py-1.5 rounded-md font-medium">
                    {Math.max(vehicles.length - defaultMappings.length, 0)}{" "}
                    vehicles open
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-220">
                  <thead className="bg-primarybg/50 border-b border-primary/5">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Vehicle Name
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Vehicle Number
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Vehicle Type
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Driver Name
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Driver Phone
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {filteredDefaultMappings.length > 0 ? (
                      filteredDefaultMappings.map((m) => (
                        <tr
                          key={m.id}
                          className="hover:bg-primary/5 transition-colors group"
                        >
                          <td className="px-6 py-4 text-sm font-semibold text-primarytext">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <User size={16} />
                              </div>
                              <div>
                                <p className="font-semibold text-primarytext group-hover:text-primary transition-colors">
                                  {m.vehicle_name || m.vehicle_number}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-secondarytext font-mono">
                            {m.vehicle_number}
                          </td>
                          <td className="px-6 py-4 text-sm text-primarytext">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary font-medium">
                              {m.vehicle_type || "-"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-primarytext">
                            {m.driver_name || "-"}
                          </td>
                          <td className="px-6 py-4 text-sm text-secondarytext">
                            {m.driver_phone || "-"}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEditMappingModal(m)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-semibold"
                              >
                                <Edit2 size={13} /> Edit
                              </button>
                              <button
                                onClick={() => handleDeleteMapping(m.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red/10 text-red hover:bg-red/20 transition-colors text-xs font-semibold"
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-3 text-secondarytext">
                            <div className="w-14 h-14 rounded-full bg-primarybg flex items-center justify-center">
                              <User size={28} className="opacity-50" />
                            </div>
                            <p className="font-medium text-primarytext">
                              No default mappings found
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Vehicles Table - Fleet View */}
      {viewMode === "fleet" && (
        <div className="bg-secondarybg rounded-md shadow-sm border border-primary/10 overflow-hidden">
          {loading ? (
            <Loading fullScreen={false} text="Loading fleet data..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-215">
                <thead>
                  <tr className="bg-primarybg/50">
                    <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Vehicle Info
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Specs
                    </th>
                    {filterType === "BUS" && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Route
                      </th>
                    )}
                    <th className="px-6 py-4 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles && filteredVehicles.length > 0 ? (
                    filteredVehicles.map((v, index) => (
                      <tr
                        key={v.id}
                        onClick={() => openDetailModal(v)}
                        className={`group cursor-pointer transition-all duration-200 hover:bg-primary/5 ${
                          index !== filteredVehicles.length - 1
                            ? "border-b border-primary/5"
                            : ""
                        }`}
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <div
                              className={`h-12 w-12 rounded-md flex items-center justify-center shadow-sm ${
                                v.vehicle_type === "BUS"
                                  ? "bg-primary/10 text-primary"
                                  : v.vehicle_type === "CAR"
                                    ? "bg-green/10 text-green"
                                    : v.vehicle_type === "BATTERY_VEHICLE"
                                      ? "bg-pending/10 text-pending"
                                      : "bg-secondarytext/10 text-secondarytext"
                              }`}
                            >
                              {v.vehicle_type === "BUS" ? (
                                <Bus size={22} />
                              ) : v.vehicle_type === "CAR" ? (
                                <Car size={22} />
                              ) : v.vehicle_type === "BATTERY_VEHICLE" ? (
                                <Zap size={22} />
                              ) : (
                                <Truck size={22} />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-primarytext text-base group-hover:text-primary transition-colors">
                                {getVehicleLabel(v)}
                              </div>
                              <div className="text-xs text-secondarytext mt-1">
                                <span className="font-medium">
                                  {v.vehicle_number}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md `}
                          >
                            {v.vehicle_type}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <div
                                className={`p-1.5 rounded-md ${v.fuel_type === "EV" ? "bg-primary/10" : "bg-primarybg"}`}
                              >
                                {v.fuel_type === "EV" ? (
                                  <Zap size={12} className="text-primary" />
                                ) : (
                                  <Fuel
                                    size={12}
                                    className="text-secondarytext"
                                  />
                                )}
                              </div>
                              <span className="text-sm font-medium text-primarytext">
                                {v.fuel_type}
                              </span>
                            </div>
                            <div className="text-xs text-secondarytext bg-primarybg px-2 py-1 rounded-md w-fit">
                              {v.seating_capacity} Seats
                            </div>
                          </div>
                        </td>
                        {filterType === "BUS" && (
                          <td className="px-6 py-5">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green shadow-sm"></div>
                                <span className="text-sm font-medium text-primarytext">
                                  {v.start_point || "-"}
                                </span>
                              </div>
                              <div className="ml-1 h-4 border-l-2 border-dashed border-secondarytext/30"></div>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red shadow-sm"></div>
                                <span className="text-sm font-medium text-primarytext">
                                  {v.end_point || "-"}
                                </span>
                              </div>
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-5 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            {getStatusBadge(v.status, {
                              iconSize: 14,
                              extraCls: "min-w-28 justify-center",
                            })}
                            {v.replacement_vehicle_number && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-md bg-skyblue/10 text-skyblue">
                                <RefreshCw size={10} />
                                Replaced: {v.replacement_vehicle_number}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={filterType === "BUS" ? 5 : 4}
                        className="px-6 py-16 text-center"
                      >
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-16 h-16 bg-primarybg rounded-md flex items-center justify-center">
                            <Bus size={32} className="text-secondarytext/50" />
                          </div>
                          <div>
                            <p className="text-primarytext font-medium mb-1">
                              No vehicles found
                            </p>
                            <p className="text-secondarytext text-sm">
                              Add a vehicle to get started
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Default Driver Mapping Modal */}
      {showMappingModal && (
        <div
          className="fixed inset-0 bg-black/60 overflow-y-auto z-50 animate-overlayFadeIn"
          onClick={closeMappingModal}
        >
          <div className="flex items-start justify-center min-h-full p-4">
            <div
              className="bg-secondarybg rounded-md shadow-2xl w-full max-w-2xl my-8 animate-modalSlideIn"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 sm:px-6 py-4 border-b border-primary/10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <User size={18} />
                  </div>
                  <h3 className="text-lg font-bold text-primarytext">
                    {isEditingMapping
                      ? "Edit Default Driver Mapping"
                      : "Create Default Driver Mapping"}
                  </h3>
                </div>
                <button
                  onClick={closeMappingModal}
                  className="text-secondarytext hover:text-primarytext"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-2">
                      Vehicle
                    </label>
                    <SearchableSelect
                      value={mappingForm.vehicle_id}
                      onChange={(value) =>
                        setMappingForm((prev) => ({
                          ...prev,
                          vehicle_id: String(value || ""),
                        }))
                      }
                      placeholder="Search vehicle by name or number"
                      options={mappingVehicleOptions}
                      emptyMessage="No available vehicles found"
                      isWhite={true}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-2">
                      Driver
                    </label>
                    <SearchableSelect
                      value={mappingForm.driver_id}
                      onChange={(value) =>
                        setMappingForm((prev) => ({
                          ...prev,
                          driver_id: String(value || ""),
                        }))
                      }
                      placeholder="Search driver by name or phone"
                      options={mappingDriverOptions}
                      emptyMessage="No drivers found"
                      isWhite={true}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={mappingForm.notes}
                    onChange={(e) =>
                      setMappingForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    placeholder="Add notes"
                    className="w-full border border-primary/10 rounded-md px-3 py-2.5 bg-secondarybg text-primarytext focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  />
                </div>
              </div>

              <div className="px-5 sm:px-6 py-4 border-t border-primary/10 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button
                  onClick={closeMappingModal}
                  className="px-4 py-2 rounded-md text-secondarytext hover:bg-primarybg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitMapping}
                  className="px-4 py-2 rounded-md bg-primary text-white hover:bg-primarydull transition-colors font-medium"
                >
                  {isEditingMapping ? "Update Mapping" : "Create Mapping"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Detail Modal */}
      {showDetailModal && selectedVehicle && (
        <div
          className="fixed inset-0 bg-black/60 overflow-y-auto z-50 animate-overlayFadeIn"
          onClick={() => setShowDetailModal(false)}
        >
          <div className="flex items-start justify-center min-h-full p-4">
            <div
              className="bg-secondarybg rounded-md shadow-2xl w-full max-w-4xl my-8 animate-modalSlideIn"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 sm:px-6 py-5 border-b border-primary/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={`p-3 rounded-md ${
                      selectedVehicle.vehicle_type === "BUS"
                        ? "bg-primary text-white"
                        : selectedVehicle.vehicle_type === "CAR"
                          ? "bg-green text-white"
                          : selectedVehicle.vehicle_type === "BATTERY_VEHICLE"
                            ? "bg-pending text-white"
                            : "bg-secondarytext text-white"
                    }`}
                  >
                    {selectedVehicle.vehicle_type === "BUS" ? (
                      <Bus size={22} />
                    ) : selectedVehicle.vehicle_type === "CAR" ? (
                      <Car size={22} />
                    ) : selectedVehicle.vehicle_type === "BATTERY_VEHICLE" ? (
                      <Zap size={22} />
                    ) : (
                      <Truck size={22} />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-primarytext">
                      {getVehicleLabel(selectedVehicle)}
                    </h2>
                    <p className="text-sm text-secondarytext mt-0.5">
                      {selectedVehicle.vehicle_number} •{" "}
                      {getVehicleTypeLabel(selectedVehicle.vehicle_type)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                  {getStatusBadge(selectedVehicle.status, {iconSize: 12})}
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="text-secondarytext hover:text-primarytext rounded-md p-2 hover:bg-primarybg transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6 space-y-4">
                {/* Main Info Grid — always 2 columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Vehicle Information */}
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Bus size={15} className="text-primary" />
                      <h3 className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Vehicle Information
                      </h3>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">
                          Vehicle Number
                        </span>
                        <span className="text-sm font-semibold text-primarytext font-mono">
                          {selectedVehicle.vehicle_number}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">Type</span>
                        <span className="text-sm font-semibold text-primarytext font-mono">
                          {getVehicleTypeLabel(selectedVehicle.vehicle_type)}
                        </span>
                      </div>
                      {selectedVehicle.vehicle_name && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-secondarytext">
                            Name
                          </span>
                          <span className="text-sm font-semibold text-primarytext">
                            {selectedVehicle.vehicle_name}
                          </span>
                        </div>
                      )}
                      {selectedVehicle.permit_number && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-secondarytext">
                            Permit No.
                          </span>
                          <span className="text-sm font-semibold text-primarytext font-mono">
                            {selectedVehicle.permit_number}
                          </span>
                        </div>
                      )}
                      {selectedVehicle.additional_permit && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-secondarytext">
                            Additional Permit
                          </span>
                          <span className="text-sm font-semibold text-primarytext">
                            {selectedVehicle.additional_permit}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Specifications */}
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Fuel size={15} className="text-primary" />
                      <h3 className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Specifications
                      </h3>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">
                          Fuel Type
                        </span>
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1.5 ${
                            selectedVehicle.fuel_type === "EV"
                              ? "bg-primary/10 text-primary"
                              : "bg-secondarytext/10 text-secondarytext"
                          }`}
                        >
                          {selectedVehicle.fuel_type === "EV" ? (
                            <Zap size={11} />
                          ) : (
                            <Fuel size={11} />
                          )}
                          {selectedVehicle.fuel_type}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">
                          Seating Capacity
                        </span>
                        <span className="text-sm font-semibold text-primarytext bg-secondarybg px-2 py-0.5 rounded-md border border-primary/10">
                          {selectedVehicle.seating_capacity} Seats
                        </span>
                      </div>
                      {selectedVehicle.chassis_number && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-secondarytext">
                            Chassis No.
                          </span>
                          <span className="text-sm font-semibold text-primarytext font-mono">
                            {selectedVehicle.chassis_number}
                          </span>
                        </div>
                      )}
                      {selectedVehicle.engine_number && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-secondarytext">
                            Engine No.
                          </span>
                          <span className="text-sm font-semibold text-primarytext font-mono">
                            {selectedVehicle.engine_number}
                          </span>
                        </div>
                      )}
                      {selectedVehicle.insurance_amount != null && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-secondarytext">
                            Insurance Amount
                          </span>
                          <span className="text-sm font-semibold text-primarytext">
                            ₹
                            {Number(
                              selectedVehicle.insurance_amount,
                            ).toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                      {selectedVehicle.road_tax_amount != null && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-secondarytext">
                            Road Tax Amount
                          </span>
                          <span className="text-sm font-semibold text-primarytext">
                            ₹
                            {Number(
                              selectedVehicle.road_tax_amount,
                            ).toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Route Strip — Bus only, compact single row */}
                {selectedVehicle.vehicle_type === "BUS" && (
                  <div className="bg-primarybg rounded-md px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-primary" />
                      <span className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Route
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-primarytext">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green inline-block" />
                        {selectedVehicle.start_point || "-"}
                      </span>
                      <span className="text-secondarytext/40 font-normal">
                        →
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red inline-block" />
                        {selectedVehicle.end_point || "-"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Replacement info strip — only when vehicle is replaced */}
                {selectedVehicle.replacement_vehicle_number && (
                  <div className="bg-skyblue/5 border border-skyblue/20 rounded-md px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <RefreshCw size={14} className="text-skyblue" />
                      <span className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Replacement
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-semibold text-skyblue">
                        {selectedVehicle.replacement_vehicle_number}
                      </span>
                      {selectedVehicle.replacement_reason && (
                        <span className="text-secondarytext capitalize">
                          {selectedVehicle.replacement_reason.replace(
                            /_/g,
                            " ",
                          )}
                        </span>
                      )}
                      {selectedVehicle.replacement_start_date && (
                        <span className="text-secondarytext">
                          {selectedVehicle.replacement_start_date} –{" "}
                          {selectedVehicle.replacement_end_date || "Ongoing"}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Documents & Expiry */}
                {(selectedVehicle.insurance_expire_date ||
                  selectedVehicle.fc_expire_date ||
                  selectedVehicle.permit_expire_date ||
                  selectedVehicle.pollution_expire ||
                  selectedVehicle.green_tax_expire ||
                  selectedVehicle.mv_tax_expire) && (
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Shield size={16} className="text-primary" />
                        <h3 className="text-sm font-bold text-secondarytext uppercase tracking-wider">
                          Documents & Expiry
                        </h3>
                      </div>
                      <button
                        onClick={() => fetchDocumentHistory(selectedVehicle)}
                        className="flex items-center gap-1.5 text-xs text-primary font-semibold px-3 py-1.5 bg-primary/10 rounded-md hover:bg-primary/20 transition-colors"
                      >
                        <History size={12} /> View History
                      </button>
                    </div>

                    {/* Insurance / FC / Permit */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {selectedVehicle.insurance_expire_date && (
                        <div className="bg-secondarybg rounded-md p-4 border border-primary/10">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield size={13} className="text-skyblue" />
                            <span className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                              Insurance
                            </span>
                          </div>
                          {selectedVehicle.insurance_start_date && (
                            <p className="text-xs text-secondarytext mb-1">
                              From:{" "}
                              {formatDate(selectedVehicle.insurance_start_date)}
                            </p>
                          )}
                          <p className="text-sm font-bold text-primarytext">
                            {formatDate(selectedVehicle.insurance_expire_date)}
                          </p>
                          {(() => {
                            const days = getDaysUntil(
                              selectedVehicle.insurance_expire_date,
                            );
                            return days !== null ? (
                              <span
                                className={`mt-1.5 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${getStatusColor(days)}`}
                              >
                                {days < 0
                                  ? `${Math.abs(days)}d overdue`
                                  : `${days}d left`}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      )}
                      {selectedVehicle.fc_expire_date && (
                        <div className="bg-secondarybg rounded-md p-4 border border-primary/10">
                          <div className="flex items-center gap-2 mb-2">
                            <FileCheck size={13} className="text-green" />
                            <span className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                              FC
                            </span>
                          </div>
                          {selectedVehicle.fc_start_date && (
                            <p className="text-xs text-secondarytext mb-1">
                              From: {formatDate(selectedVehicle.fc_start_date)}
                            </p>
                          )}
                          <p className="text-sm font-bold text-primarytext">
                            {formatDate(selectedVehicle.fc_expire_date)}
                          </p>
                          {(() => {
                            const days = getDaysUntil(
                              selectedVehicle.fc_expire_date,
                            );
                            return days !== null ? (
                              <span
                                className={`mt-1.5 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${getStatusColor(days)}`}
                              >
                                {days < 0
                                  ? `${Math.abs(days)}d overdue`
                                  : `${days}d left`}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      )}
                      {selectedVehicle.permit_expire_date && (
                        <div className="bg-secondarybg rounded-md p-4 border border-primary/10">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText size={13} className="text-primary" />
                            <span className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                              Permit
                            </span>
                          </div>
                          {selectedVehicle.permit_start_date && (
                            <p className="text-xs text-secondarytext mb-1">
                              From:{" "}
                              {formatDate(selectedVehicle.permit_start_date)}
                            </p>
                          )}
                          <p className="text-sm font-bold text-primarytext">
                            {formatDate(selectedVehicle.permit_expire_date)}
                          </p>
                          {(() => {
                            const days = getDaysUntil(
                              selectedVehicle.permit_expire_date,
                            );
                            return days !== null ? (
                              <span
                                className={`mt-1.5 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${getStatusColor(days)}`}
                              >
                                {days < 0
                                  ? `${Math.abs(days)}d overdue`
                                  : `${days}d left`}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Pollution / Green Tax / MV Tax */}
                    {(selectedVehicle.pollution_expire ||
                      selectedVehicle.green_tax_expire ||
                      selectedVehicle.mv_tax_expire) && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                        {selectedVehicle.pollution_expire && (
                          <div className="bg-secondarybg rounded-md p-3 border border-primary/10">
                            <div className="flex items-center gap-2 mb-1.5">
                              <AlertCircle size={13} className="text-pending" />
                              <span className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                                Pollution (PUC)
                              </span>
                            </div>
                            <p className="text-sm font-bold text-primarytext">
                              {formatDate(selectedVehicle.pollution_expire)}
                            </p>
                            {(() => {
                              const days = getDaysUntil(
                                selectedVehicle.pollution_expire,
                              );
                              return days !== null ? (
                                <span
                                  className={`mt-1 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${getStatusColor(days)}`}
                                >
                                  {days < 0
                                    ? `${Math.abs(days)}d overdue`
                                    : `${days}d left`}
                                </span>
                              ) : null;
                            })()}
                          </div>
                        )}
                        {selectedVehicle.green_tax_expire && (
                          <div className="bg-secondarybg rounded-md p-3 border border-primary/10">
                            <div className="flex items-center gap-2 mb-1.5">
                              <RefreshCw size={13} className="text-green" />
                              <span className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                                Green Tax
                              </span>
                            </div>
                            <p className="text-sm font-bold text-primarytext">
                              {formatDate(selectedVehicle.green_tax_expire)}
                            </p>
                            {(() => {
                              const days = getDaysUntil(
                                selectedVehicle.green_tax_expire,
                              );
                              return days !== null ? (
                                <span
                                  className={`mt-1 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${getStatusColor(days)}`}
                                >
                                  {days < 0
                                    ? `${Math.abs(days)}d overdue`
                                    : `${days}d left`}
                                </span>
                              ) : null;
                            })()}
                          </div>
                        )}
                        {selectedVehicle.mv_tax_expire && (
                          <div className="bg-secondarybg rounded-md p-3 border border-primary/10">
                            <div className="flex items-center gap-2 mb-1.5">
                              <FileText size={13} className="text-primary" />
                              <span className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                                MV Tax
                              </span>
                            </div>
                            <p className="text-sm font-bold text-primarytext">
                              {formatDate(selectedVehicle.mv_tax_expire)}
                            </p>
                            {(() => {
                              const days = getDaysUntil(
                                selectedVehicle.mv_tax_expire,
                              );
                              return days !== null ? (
                                <span
                                  className={`mt-1 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${getStatusColor(days)}`}
                                >
                                  {days < 0
                                    ? `${Math.abs(days)}d overdue`
                                    : `${days}d left`}
                                </span>
                              ) : null;
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer with Actions */}
              <div className="px-4 sm:px-6 py-4 border-t border-primary/10 flex flex-col-reverse sm:flex-row sm:justify-end items-stretch sm:items-center gap-3">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="w-full sm:w-auto px-5 py-2.5 text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md font-semibold transition-colors text-sm"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleDelete(selectedVehicle.id);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 border border-red text-red hover:bg-red/10 rounded-md font-semibold transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleEdit(selectedVehicle);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-primary text-white rounded-md font-semibold hover:bg-primarydull transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <Edit2 size={16} />
                  Edit Vehicle
                </button>
              </div>
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
            className="bg-secondarybg rounded-md shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden animate-scaleIn flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-primarybg/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <HardDriveUpload size={18} strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-primarytext leading-tight">
                    Bulk Upload Vehicles
                  </h2>
                  <p className="text-xs text-secondarytext mt-0.5">
                    Import fleet entries from Google Sheets or a local Excel /
                    CSV file
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

            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-6 space-y-5">
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

                <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-5">
                  <div className="space-y-4">
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
                              {bulkPreviewLoading
                                ? "Validating..."
                                : "Validate"}
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
                              ? "Validating..."
                              : "Validate File"}
                          </button>
                        </div>
                      )}
                    </div>

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
                        Vehicle number must be unique. Use vehicle type values
                        from master list like BUS, CAR, BATTERY_VEHICLE.
                      </p>
                    </div>
                  </div>

                  <div className="border border-primarybg rounded-md bg-secondarybg p-5 flex flex-col gap-4">
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

                        <div
                          className={`flex items-center gap-3 pl-5 pr-4 py-3 rounded-md relative overflow-hidden ${
                            bulkPreview.invalid_rows > 0
                              ? "bg-red/5"
                              : "bg-green/5"
                          }`}
                        >
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
                              <AlertCircle size={14} />
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
                                Vehicle
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                                Type / Fuel
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                                Capacity
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
                                    {row.vehicle_number || "-"}
                                  </p>
                                  <p className="text-xs text-secondarytext mt-0.5">
                                    {row.vehicle_name || "No vehicle name"}
                                  </p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-sm text-primarytext">
                                    {getVehicleTypeLabel(row.vehicle_type)}
                                  </p>
                                  <p className="text-xs text-secondarytext mt-0.5">
                                    {row.fuel_type || "-"}
                                  </p>
                                </td>
                                <td className="px-4 py-3 text-sm text-primarytext">
                                  {row.seating_capacity ?? "-"}
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
                                            *
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
                    ? "Validating..."
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
                  {bulkImportLoading ? "Importing..." : "Import Vehicles"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Vehicle Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 overflow-y-auto animate-overlayFadeIn"
          onClick={() => {
            setShowCreateModal(false);
            setVehicleForm(initialFormState);
            setIsEditing(false);
            setEditingId(null);
          }}
        >
          <div className="flex items-start justify-center min-h-full p-4">
            <div
              className="bg-secondarybg rounded-md shadow-2xl w-full max-w-4xl my-8 animate-modalSlideIn"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 sm:p-6 border-b border-primarybg/50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="p-3 rounded-md bg-primary">
                      {isEditing ? (
                        <Edit2 className="text-secondarybg" size={24} />
                      ) : (
                        <Bus className="text-secondarybg" size={24} />
                      )}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-primarytext">
                        {isEditing ? "Edit Vehicle" : "Add New Vehicle"}
                      </h2>
                      <p className="text-sm text-secondarytext">
                        {isEditing
                          ? "Update vehicle information"
                          : "Register a new vehicle to the fleet"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setVehicleForm(initialFormState);
                      setIsEditing(false);
                      setEditingId(null);
                    }}
                    className="text-secondarytext hover:text-primarytext rounded-md p-2 hover:bg-primarybg transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Vehicle Information */}
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Car size={18} className="text-primary" />
                      <h3 className="text-sm font-bold text-secondarytext uppercase tracking-wider">
                        Vehicle Information
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {/* Vehicle Category */}
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Category *
                        </label>
                        <CustomDropdown
                          value={vehicleForm.vehicle_type}
                          onChange={(val) =>
                            setVehicleForm({...vehicleForm, vehicle_type: val})
                          }
                          isWhite
                          options={vehicleTypeOptions.filter(
                            (type) => type.value !== "ALL",
                          )}
                          placeholder="Select vehicle category..."
                          width="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Vehicle Name *
                        </label>
                        <input
                          placeholder="e.g., Bus-01, Staff Car"
                          value={vehicleForm.vehicle_name}
                          onChange={(e) =>
                            setVehicleForm({
                              ...vehicleForm,
                              vehicle_name: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Registration Number *
                        </label>
                        <input
                          placeholder="e.g., TN36AB1234"
                          value={vehicleForm.vehicle_number}
                          onChange={(e) =>
                            setVehicleForm({
                              ...vehicleForm,
                              vehicle_number: e.target.value.toUpperCase(),
                            })
                          }
                          className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium font-mono uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Specifications */}
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Fuel size={18} className="text-primary" />
                      <h3 className="text-sm font-bold text-secondarytext uppercase tracking-wider">
                        Specifications
                      </h3>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Status *
                        </label>
                        <CustomDropdown
                          value={vehicleForm.status}
                          onChange={(val) =>
                            setVehicleForm({...vehicleForm, status: val})
                          }
                          isWhite
                          options={[
                            {
                              value: "available",
                              label: "Available",
                              icon: CheckCircle,
                              iconColor: "text-green-500",
                            },
                            {
                              value: "in_service",
                              label: "In Service",
                              icon: Wrench,
                              iconColor: "text-pending",
                            },
                            {
                              value: "not_available",
                              label: "Not Available",
                              icon: XCircle,
                              iconColor: "text-red-500",
                            },
                          ]}
                          width="w-full"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Fuel Type *
                          </label>
                          <CustomDropdown
                            value={vehicleForm.fuel_type}
                            onChange={(val) =>
                              setVehicleForm({...vehicleForm, fuel_type: val})
                            }
                            isWhite
                            options={[
                              {value: "DIESEL", label: "Diesel", icon: Fuel},
                              {value: "PETROL", label: "Petrol", icon: Fuel},
                              {value: "CNG", label: "CNG", icon: Fuel},
                              {value: "EV", label: "Electric", icon: Zap},
                            ]}
                            width="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Seating Capacity *
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={vehicleForm.seating_capacity}
                            onChange={(e) =>
                              setVehicleForm({
                                ...vehicleForm,
                                seating_capacity: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                          />
                        </div>
                      </div>
                      {/* Route Details (Bus Only) */}
                      {vehicleForm.vehicle_type === "BUS" && (
                        <>
                          <div className="pt-2 border-t border-primarybg">
                            <label className="block text-sm font-semibold text-primarytext mb-1">
                              Start Point
                            </label>
                            <input
                              placeholder="e.g., Main Campus"
                              value={vehicleForm.start_point}
                              onChange={(e) =>
                                setVehicleForm({
                                  ...vehicleForm,
                                  start_point: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-primarytext mb-1">
                              End Point
                            </label>
                            <input
                              placeholder="e.g., Central Station"
                              value={vehicleForm.end_point}
                              onChange={(e) =>
                                setVehicleForm({
                                  ...vehicleForm,
                                  end_point: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Insurance & FC Details */}
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Shield size={18} className="text-primary" />
                      <h3 className="text-sm font-bold text-secondarytext uppercase tracking-wider">
                        Insurance & FC
                      </h3>
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Insurance Start Date
                          </label>
                          <input
                            type="date"
                            value={vehicleForm.insurance_start_date}
                            onChange={(e) =>
                              setVehicleForm({
                                ...vehicleForm,
                                insurance_start_date: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Insurance Expiry Date
                          </label>
                          <input
                            type="date"
                            value={vehicleForm.insurance_expire_date}
                            onChange={(e) =>
                              setVehicleForm({
                                ...vehicleForm,
                                insurance_expire_date: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Insurance Amount
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g., 25000.00"
                          value={vehicleForm.insurance_amount}
                          onChange={(e) =>
                            setVehicleForm({
                              ...vehicleForm,
                              insurance_amount: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                        />
                      </div>
                      <div className="border-t border-primarybg pt-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-semibold text-primarytext mb-1">
                              FC Start Date
                            </label>
                            <input
                              type="date"
                              value={vehicleForm.fc_start_date}
                              onChange={(e) =>
                                setVehicleForm({
                                  ...vehicleForm,
                                  fc_start_date: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-primarytext mb-1">
                              FC Expiry Date
                            </label>
                            <input
                              type="date"
                              value={vehicleForm.fc_expire_date}
                              onChange={(e) =>
                                setVehicleForm({
                                  ...vehicleForm,
                                  fc_expire_date: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Permit & Registration Details */}
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <FileCheck size={18} className="text-primary" />
                      <h3 className="text-sm font-bold text-secondarytext uppercase tracking-wider">
                        Permit & Registration
                      </h3>
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Chassis Number
                          </label>
                          <input
                            placeholder="e.g., MAT448208..."
                            value={vehicleForm.chassis_number}
                            onChange={(e) =>
                              setVehicleForm({
                                ...vehicleForm,
                                chassis_number: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Engine Number
                          </label>
                          <input
                            placeholder="e.g., 497TC14..."
                            value={vehicleForm.engine_number}
                            onChange={(e) =>
                              setVehicleForm({
                                ...vehicleForm,
                                engine_number: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Permit Number
                        </label>
                        <input
                          placeholder="e.g., TN/36/..."
                          value={vehicleForm.permit_number}
                          onChange={(e) =>
                            setVehicleForm({
                              ...vehicleForm,
                              permit_number: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium font-mono"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Permit Start Date
                          </label>
                          <input
                            type="date"
                            value={vehicleForm.permit_start_date}
                            onChange={(e) =>
                              setVehicleForm({
                                ...vehicleForm,
                                permit_start_date: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Permit Expiry Date
                          </label>
                          <input
                            type="date"
                            value={vehicleForm.permit_expire_date}
                            onChange={(e) =>
                              setVehicleForm({
                                ...vehicleForm,
                                permit_expire_date: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                          />
                        </div>
                      </div>
                      <div className="border-t border-primarybg pt-3">
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Road Tax Amount
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g., 5000.00"
                          value={vehicleForm.road_tax_amount}
                          onChange={(e) =>
                            setVehicleForm({
                              ...vehicleForm,
                              road_tax_amount: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tax & Compliance */}
                <div className="bg-primarybg rounded-md p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText size={18} className="text-primary" />
                    <h3 className="text-sm font-bold text-secondarytext uppercase tracking-wider">
                      Tax & Compliance
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-primarytext mb-1">
                        Pollution Certificate Expiry
                      </label>
                      <input
                        type="date"
                        value={vehicleForm.pollution_expire}
                        onChange={(e) =>
                          setVehicleForm({
                            ...vehicleForm,
                            pollution_expire: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-primarytext mb-1">
                        Green Tax Expiry
                      </label>
                      <input
                        type="date"
                        value={vehicleForm.green_tax_expire}
                        onChange={(e) =>
                          setVehicleForm({
                            ...vehicleForm,
                            green_tax_expire: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-primarytext mb-1">
                        MV Tax Expiry
                      </label>
                      <input
                        type="date"
                        value={vehicleForm.mv_tax_expire}
                        onChange={(e) =>
                          setVehicleForm({
                            ...vehicleForm,
                            mv_tax_expire: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                      />
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-primary/5 border border-primary/10 rounded-md">
                    <p className="text-xs text-secondarytext flex items-center gap-1.5">
                      <Calendar size={14} className="text-primary shrink-0" />
                      All changes to document dates are tracked in the audit
                      log. You'll get alerts when documents are about to expire.
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-primarybg">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setVehicleForm(initialFormState);
                      setIsEditing(false);
                      setEditingId(null);
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 bg-red-50 text-red hover:bg-red-100 border border-red-200 rounded-md transition-colors font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="w-full sm:w-auto px-5 py-2.5 bg-primary text-white rounded-md hover:bg-green-700 transition-colors font-semibold text-sm flex items-center justify-center gap-2"
                  >
                    {isEditing ? <Edit2 size={16} /> : <Plus size={16} />}
                    {isEditing ? "Update Vehicle" : "Create Vehicle"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Detail Modal (opened from expiry table row click) */}
      {showDocDetailModal && docDetailVehicle && (
        <div
          className="fixed inset-0 bg-black/60 overflow-y-auto z-50 animate-overlayFadeIn"
          onClick={() => setShowDocDetailModal(false)}
        >
          <div className="flex items-start justify-center min-h-full p-4">
            <div
              className="bg-secondarybg rounded-md shadow-2xl w-full max-w-xl overflow-hidden my-8 animate-modalSlideIn"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-primary/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-md ${
                        docDetailVehicle.vehicle_type === "BUS"
                          ? "bg-primary text-white"
                          : docDetailVehicle.vehicle_type === "CAR"
                            ? "bg-green text-white"
                            : docDetailVehicle.vehicle_type ===
                                "BATTERY_VEHICLE"
                              ? "bg-pending text-white"
                              : "bg-secondarytext text-white"
                      }`}
                    >
                      {docDetailVehicle.vehicle_type === "BUS" ? (
                        <Bus size={20} />
                      ) : docDetailVehicle.vehicle_type === "CAR" ? (
                        <Car size={20} />
                      ) : docDetailVehicle.vehicle_type ===
                        "BATTERY_VEHICLE" ? (
                        <Zap size={20} />
                      ) : (
                        <Truck size={20} />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-primarytext">
                        {docDetailVehicle.vehicle_name ||
                          docDetailVehicle.vehicle_number}
                      </h3>
                      <p className="text-sm text-secondarytext">
                        {docDetailVehicle.vehicle_number} — Document Details
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDocDetailModal(false)}
                    className="p-2 text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Document Cards */}
              <div className="p-6 space-y-4">
                {[
                  {
                    key: "insurance",
                    label: "Insurance",
                    icon: Shield,
                    color: "skyblue",
                    startDate: docDetailVehicle.insurance_start_date,
                    expiryDate: docDetailVehicle.insurance_expire_date,
                    days: getDaysUntil(docDetailVehicle.insurance_expire_date),
                  },
                  {
                    key: "fc",
                    label: "FC (Fitness Certificate)",
                    icon: FileCheck,
                    color: "green",
                    startDate: docDetailVehicle.fc_start_date,
                    expiryDate: docDetailVehicle.fc_expire_date,
                    days: getDaysUntil(docDetailVehicle.fc_expire_date),
                  },
                  {
                    key: "permit",
                    label: "Permit",
                    icon: FileText,
                    color: "primary",
                    startDate: docDetailVehicle.permit_start_date,
                    expiryDate: docDetailVehicle.permit_expire_date,
                    days: getDaysUntil(docDetailVehicle.permit_expire_date),
                  },
                ].map((doc) => {
                  const Icon = doc.icon;
                  return (
                    <div
                      key={doc.key}
                      className={`bg-primarybg rounded-md p-4 border-l-4 ${
                        doc.days !== null && doc.days < 0
                          ? "border-l-red"
                          : doc.days !== null && doc.days <= 30
                            ? "border-l-pending"
                            : `border-l-${doc.color}`
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Icon size={16} className={`text-${doc.color}`} />
                          <h4 className="font-bold text-primarytext text-sm">
                            {doc.label}
                          </h4>
                        </div>
                        {doc.days !== null && (
                          <span
                            className={`px-2.5 py-1 rounded-md text-xs font-bold ${getStatusColor(doc.days)}`}
                          >
                            {doc.days < 0
                              ? `${Math.abs(doc.days)} days overdue`
                              : `${doc.days} days left`}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-secondarytext uppercase tracking-wide font-semibold mb-0.5">
                            Start Date
                          </p>
                          <p className="text-sm font-medium text-primarytext">
                            {formatDate(doc.startDate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-secondarytext uppercase tracking-wide font-semibold mb-0.5">
                            Expiry Date
                          </p>
                          <p className="text-sm font-medium text-primarytext">
                            {formatDate(doc.expiryDate)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 border-t border-primary/10 flex justify-between items-center">
                <button
                  onClick={() => {
                    setShowDocDetailModal(false);
                    fetchDocumentHistory(docDetailVehicle);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-secondarytext hover:text-primary hover:bg-primary/5 rounded-md transition-colors"
                >
                  <History size={15} />
                  View History
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowDocDetailModal(false)}
                    className="px-4 py-2 text-sm font-semibold text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setShowDocDetailModal(false);
                      handleEdit(docDetailVehicle);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primarydull transition-colors text-sm font-semibold"
                  >
                    <Edit2 size={15} />
                    Edit Documents
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document History Modal */}
      {showHistoryModal && historyVehicle && (
        <div
          className="fixed inset-0 bg-black/60 overflow-y-auto z-50 animate-overlayFadeIn"
          onClick={() => setShowHistoryModal(false)}
        >
          <div className="flex items-start justify-center min-h-full p-4">
            <div
              className="bg-secondarybg rounded-md shadow-2xl w-full max-w-2xl overflow-hidden my-8 animate-modalSlideIn"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-primary/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-md">
                      <History size={20} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-primarytext">
                        Document Change History
                      </h3>
                      <p className="text-sm text-secondarytext">
                        {historyVehicle.vehicle_name ||
                          historyVehicle.vehicle_number}{" "}
                        — {historyVehicle.vehicle_number}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="p-2 text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-1 mt-4 bg-primarybg rounded-md p-1">
                  {[
                    {key: "all", label: "All"},
                    {key: "insurance", label: "Insurance"},
                    {key: "fc", label: "FC"},
                    {key: "permit", label: "Permit"},
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setHistoryFilter(tab.key)}
                      className={`flex-1 px-3 py-2 text-xs font-semibold rounded-md transition-all ${
                        historyFilter === tab.key
                          ? "bg-primary text-white shadow-sm"
                          : "text-secondarytext hover:text-primarytext hover:bg-secondarybg"
                      }`}
                    >
                      {tab.label}
                      {tab.key !== "all" &&
                        historyGrouped[tab.key]?.length > 0 && (
                          <span
                            className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] ${
                              historyFilter === tab.key
                                ? "bg-white/20"
                                : "bg-primarybg"
                            }`}
                          >
                            {historyGrouped[tab.key].length}
                          </span>
                        )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="p-5 max-h-[62vh] overflow-y-auto space-y-1">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-14">
                    <Loading fullScreen={false} text="Loading history..." />
                  </div>
                ) : getFilteredHistoryLogs().length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-secondarytext">
                    <div className="p-4 bg-primarybg rounded-full mb-3">
                      <History size={28} className="opacity-25" />
                    </div>
                    <p className="font-semibold text-sm">
                      No change history found
                    </p>
                    <p className="text-xs mt-1 text-secondarytext/60">
                      Changes will appear here after document details are
                      updated.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {groupLogsByDate(getFilteredHistoryLogs()).map(
                      ({date, items: dateLogs}) => (
                        <div key={date}>
                          {/* ── Date Group Header ── */}
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 rounded-full shrink-0">
                              <Calendar size={11} className="text-primary" />
                              <span className="text-[11px] font-bold text-primary uppercase tracking-wide">
                                {formatGroupDate(date)}
                              </span>
                            </div>
                            <div className="flex-1 h-px bg-primary/10" />
                            <span className="text-[10px] text-secondarytext shrink-0">
                              {dateLogs.length} change
                              {dateLogs.length !== 1 ? "s" : ""}
                            </span>
                          </div>

                          {/* ── Column header row (shown once per group) ── */}
                          <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-1.5 px-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-secondarytext/50 text-left pl-3">
                              Previous
                            </span>
                            <span className="w-px" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-secondarytext/50 text-left pl-3">
                              Changed to
                            </span>
                          </div>

                          {/* ── Cards for this date ── */}
                          <div className="space-y-2">
                            {dateLogs.map((log) => (
                              <div
                                key={log.id}
                                className="rounded-md border border-primary/10 bg-secondarybg overflow-hidden shadow-sm"
                              >
                                {/* Card header: doc type + field + time + user */}
                                <div className="flex items-center justify-between px-4 py-2 bg-primarybg border-b border-primary/10">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${getDocTypeColor(log.document_type)}`}
                                    >
                                      {formatDocType(log.document_type)}
                                    </span>
                                    <span className="text-xs font-semibold text-primarytext">
                                      {formatFieldName(log.field_name)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] text-secondarytext">
                                    <Clock size={10} />
                                    <span>
                                      {log.changed_at?.split(" ")[1] || ""}
                                    </span>
                                    <span className="opacity-30 mx-0.5">·</span>
                                    <User size={10} />
                                    <span>{log.changed_by_name}</span>
                                  </div>
                                </div>

                                {/* Two-column value row */}
                                <div className="grid grid-cols-2 divide-x divide-primary/10">
                                  {/* Left — Previous value */}
                                  <div className="px-4 py-2.5">
                                    {log.old_value ? (
                                      <p className="text-sm font-medium text-red/80 line-through">
                                        {log.old_value}
                                      </p>
                                    ) : (
                                      <p className="text-sm italic text-secondarytext/35">
                                        —
                                      </p>
                                    )}
                                  </div>

                                  {/* Right — Changed to value */}
                                  <div className="px-4 py-2.5 bg-green/4">
                                    {log.new_value ? (
                                      <p className="text-sm font-semibold text-green">
                                        {log.new_value}
                                      </p>
                                    ) : (
                                      <p className="text-sm italic text-secondarytext/35">
                                        —
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-primary/10 flex justify-between items-center">
                <p className="text-xs text-secondarytext">
                  {getFilteredHistoryLogs().length} change
                  {getFilteredHistoryLogs().length !== 1 ? "s" : ""} recorded
                </p>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="px-5 py-2 text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md font-semibold transition-colors text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Type Management Modal */}
      {showVehicleTypeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-secondarybg rounded-md shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
            {/* Header */}
            <div className="px-6 py-4 border-b border-primarybg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-md">
                  <Truck size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-primarytext">
                    {isEditingVehicleType
                      ? "Edit Vehicle Type"
                      : "Create Vehicle Type"}
                  </h2>
                  <p className="text-xs text-secondarytext mt-0.5">
                    {isEditingVehicleType
                      ? "Update the vehicle type details"
                      : "Add a new vehicle type to the system"}
                  </p>
                </div>
              </div>
              <button
                onClick={closeVehicleTypeModal}
                className="p-2 hover:bg-primarybg rounded-md transition-colors"
              >
                <X size={20} className="text-secondarytext" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Type Code */}
              <div>
                <label className="block text-sm font-semibold text-primarytext mb-2">
                  Type Code <span className="text-red">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., BUS, CAR, BATTERY_VEHICLE"
                  value={vehicleTypeForm.type}
                  onChange={(e) =>
                    setVehicleTypeForm({
                      ...vehicleTypeForm,
                      type: e.target.value.toUpperCase(),
                    })
                  }
                  disabled={isEditingVehicleType}
                  className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium disabled:opacity-50"
                />
                <p className="text-xs text-secondarytext mt-1">
                  System identifier (uppercase)
                </p>
              </div>

              {/* Label aka Display Name */}
              <div>
                <label className="block text-sm font-semibold text-primarytext mb-2">
                  Display Label <span className="text-red">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., College Bus, Staff Car"
                  value={vehicleTypeForm.label}
                  onChange={(e) =>
                    setVehicleTypeForm({
                      ...vehicleTypeForm,
                      label: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                />
                <p className="text-xs text-secondarytext mt-1">
                  User-friendly name shown in forms and dropdowns
                </p>
              </div>

              {/* Existing Types List */}
              {!isEditingVehicleType && vehicleTypeOptions.length > 1 && (
                <div className="bg-primarybg rounded-md p-4 mt-6">
                  <h3 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
                    <Truck size={14} /> Existing Types
                  </h3>
                  <div className="space-y-2">
                    {vehicleTypeOptions
                      .filter((t) => t.value !== "ALL")
                      .map((type) => (
                        <div
                          key={type.value}
                          className="flex items-center justify-between bg-secondarybg rounded-md p-3 group hover:bg-primarybg transition-colors"
                        >
                          <div>
                            <p className="text-sm font-semibold text-primarytext">
                              {type.label}
                            </p>
                            <p className="text-xs text-secondarytext font-mono">
                              {type.value}
                            </p>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() =>
                                openEditVehicleType({
                                  id: type.id,
                                  type: type.value,
                                  label: type.label,
                                })
                              }
                              className="p-2 hover:bg-primary/10 text-primary rounded-md transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteVehicleType(type.id)}
                              className="p-2 hover:bg-red/10 text-red rounded-md transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-primarybg flex justify-between items-center gap-3">
              <button
                onClick={closeVehicleTypeModal}
                className="px-5 py-2.5 text-primarytext hover:bg-primarybg rounded-md font-semibold transition-colors text-sm"
              >
                {isEditingVehicleType ? "Back" : "Close"}
              </button>
              <button
                onClick={handleVehicleTypeSubmit}
                disabled={
                  isLoadingVehicleType ||
                  !vehicleTypeForm.type.trim() ||
                  !vehicleTypeForm.label.trim()
                }
                className="px-5 py-2.5 bg-primary text-white rounded-md font-semibold hover:bg-primarydull transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoadingVehicleType && <Loading />}
                {isEditingVehicleType ? "Update Type" : "Create Type"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
