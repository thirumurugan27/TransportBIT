import React, {useState, useEffect} from "react";
import {useAuth} from "../../../context/AuthContext";
import {
  API_BASE,
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  apiUpload,
  getToday,
} from "../../../utils/api";
import {useToast} from "../../../context/ToastContext";
import Loading from "../../../components/ui/Loading";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import {showConfirm} from "../../../utils/swal";
import {
  Fuel,
  Plus,
  Calendar,
  AlertCircle,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Droplets,
  Upload,
  ExternalLink,
  Pencil,
  Trash2,
} from "lucide-react";

export default function DriverFuelIndent() {
  const {showToast} = useToast();
  const {user} = useAuth();
  const driverId = user?.driver_id;

  const [indents, setIndents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [billUploadLoadingId, setBillUploadLoadingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [detailsEditMode, setDetailsEditMode] = useState(false);
  const [rowActionLoadingId, setRowActionLoadingId] = useState(null);
  const [editForm, setEditForm] = useState({
    filled_date: "",
    filled_time: "",
    odometer_reading: "",
    filled_liters: "",
    fuel_amount: "",
  });

  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [fuelTypes] = useState(["DIESEL", "PETROL", "CNG", "EV", "OTHER"]);

  const [form, setForm] = useState({
    vehicle_type: "",
    fuel_type: "",
    vehicle_id: "",
    filled_date: getToday(),
    filled_time: "",
    odometer_reading: "",
    filled_liters: "",
    fuel_amount: "",
    bill_file: null,
  });

  useEffect(() => {
    fetchIndents();
    fetchVehicleTypes();
  }, []);

  useEffect(() => {
    if (!driverId) return;
    fetchAssignedVehicles();
  }, [driverId]);

  useEffect(() => {
    if (!showModal || !form.vehicle_id) return;
    fetchLastVehicleReading(form.vehicle_id);
  }, [showModal, form.vehicle_id]);

  const toInputDateValue = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const datePart = raw.split(" ")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
    if (/^\d{2}-\d{2}-\d{4}$/.test(datePart)) {
      const [dd, mm, yyyy] = datePart.split("-");
      return `${yyyy}-${mm}-${dd}`;
    }
    return "";
  };

  const toInputTimeValue = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const hhmm24 = raw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
    if (hhmm24) return `${hhmm24[1]}:${hhmm24[2]}`;

    const hhmm12 = raw.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
    if (!hhmm12) return "";

    let hour = parseInt(hhmm12[1], 10);
    const minute = hhmm12[2];
    const period = hhmm12[3].toUpperCase();

    if (period === "PM" && hour < 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;

    return `${String(hour).padStart(2, "0")}:${minute}`;
  };

  const fetchIndents = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/api/driver/fuel-indents");
      if (res.ok) {
        const data = await res.json();
        setIndents(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignedVehicles = async () => {
    if (!driverId) return;
    setVehiclesLoading(true);
    try {
      const res = await apiGet(
        `/api/driver/km-log/assigned-vehicles?driver_id=${driverId}`,
      );
      if (res.ok) {
        const data = await res.json();
        const assignedVehicles = (data || []).map((vehicle) => ({
          id: vehicle.id,
          vehicle_name: vehicle.vehicle_name,
          vehicle_number: vehicle.vehicle_number,
          vehicle_type: vehicle.vehicle_type,
          fuel_type: vehicle.fuel_type,
          source_label: vehicle.source_label,
          seating_capacity: vehicle.seating_capacity,
        }));
        setVehicles(assignedVehicles);
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to load assigned vehicles", "error");
    } finally {
      setVehiclesLoading(false);
    }
  };

  const fetchLastVehicleReading = async (vehicleId) => {
    try {
      const res = await apiGet(
        `/api/driver/vehicle-last-log?vehicle_id=${vehicleId}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.end_km !== undefined && data?.end_km !== null) {
          setForm((prev) => ({...prev, odometer_reading: String(data.end_km)}));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVehicleTypes = async () => {
    try {
      const res = await apiGet("/api/vehicle-types");
      if (res.ok) {
        const data = await res.json();
        setVehicleTypes(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredVehicles = vehicles.filter((v) => {
    if (
      form.vehicle_type &&
      v.vehicle_type?.toUpperCase() !== form.vehicle_type.toUpperCase()
    )
      return false;
    if (
      form.fuel_type &&
      v.fuel_type?.toUpperCase() !== form.fuel_type.toUpperCase()
    )
      return false;
    return true;
  });

  const vehicleOptions = filteredVehicles.map((v) => ({
    value: String(v.id),
    label: v.vehicle_name || v.vehicle_number,
    subtitle: `${v.vehicle_number}${v.seating_capacity ? ` • ${v.seating_capacity} Seats` : ""}`,
  }));

  const vehicleTypeOptions = vehicleTypes.map((vt) => ({
    value: vt.type || vt,
    label: vt.label || vt.type || vt,
  }));

  const fuelTypeOptions = fuelTypes.map((ft) => ({
    value: ft,
    label: ft,
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vehicle_id) {
      showToast("Please select a vehicle", "warning");
      return;
    }
    if (!form.filled_date) {
      showToast("Filled date is required", "warning");
      return;
    }
    if (!form.filled_liters || parseFloat(form.filled_liters) <= 0) {
      showToast("Filled liters must be greater than 0", "warning");
      return;
    }
    if (!form.fuel_amount || parseFloat(form.fuel_amount) <= 0) {
      showToast("Fuel amount must be greater than 0", "warning");
      return;
    }

    setSubmitting(true);
    try {
      if (!driverId) {
        showToast("Driver account not found", "error");
        return;
      }

      const selectedVehicle = vehicles.find(
        (v) => String(v.id) === String(form.vehicle_id),
      );
      const payload = {
        vehicle_id: parseInt(form.vehicle_id),
        driver_id: parseInt(driverId),
        vehicle_type: form.vehicle_type || selectedVehicle?.vehicle_type || "",
        fuel_type: form.fuel_type || selectedVehicle?.fuel_type || "",
        filled_date: form.filled_date,
        filled_time: form.filled_time,
        odometer_reading: form.odometer_reading
          ? parseInt(form.odometer_reading)
          : 0,
        filled_liters: parseFloat(form.filled_liters),
        fuel_amount: parseFloat(form.fuel_amount),
      };

      const res = await apiPost("/api/driver/fuel-indents/create", payload);
      const responseData = await res.json();
      if (res.ok) {
        if (form.bill_file && responseData?.id) {
          const formData = new FormData();
          formData.append("file", form.bill_file);
          const billRes = await apiUpload(
            `/api/driver/fuel-indents/${responseData.id}/bill`,
            formData,
          );
          if (!billRes.ok) {
            const billErr = await billRes.json();
            showToast(
              billErr.error || "Fuel indent created, but bill upload failed",
              "warning",
            );
          }
        }
        showToast("Fuel indent raised successfully!", "success");
        closeModal();
        fetchIndents();
      } else {
        showToast(
          "Failed: " + (responseData.error || "Unknown error"),
          "error",
        );
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to raise fuel indent", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setForm({
      vehicle_type: "",
      fuel_type: "",
      vehicle_id: "",
      filled_date: getToday(),
      filled_time: "",
      odometer_reading: "",
      filled_liters: "",
      fuel_amount: "",
      bill_file: null,
    });
  };

  const getBillURL = (indent) => {
    if (!indent?.bill_file_url) return "";
    return `${API_BASE || ""}${indent.bill_file_url}`;
  };

  const handleUploadBill = async (indentId, file) => {
    if (!file) return;
    setBillUploadLoadingId(indentId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiUpload(
        `/api/driver/fuel-indents/${indentId}/bill`,
        formData,
      );
      const data = await res.json();
      if (res.ok) {
        showToast("Bill uploaded successfully", "success");
        setSelectedIndent((prev) =>
          prev && prev.id === indentId
            ? {
                ...prev,
                bill_file_url: data?.bill?.file_url || prev.bill_file_url,
                bill_original_name:
                  data?.bill?.original_name || prev.bill_original_name,
              }
            : prev,
        );
        fetchIndents();
      } else {
        showToast(data.error || "Failed to upload bill", "error");
      }
    } catch {
      showToast("Failed to upload bill", "error");
    } finally {
      setBillUploadLoadingId(null);
    }
  };

  const openDetailsModal = (indent) => {
    setSelectedIndent(indent);
    setDetailsEditMode(false);
    setEditForm({
      filled_date: toInputDateValue(indent.filled_date) || getToday(),
      filled_time: toInputTimeValue(indent.filled_time),
      odometer_reading: String(indent.odometer_reading || ""),
      filled_liters: String(indent.fuel_filled || 0),
      fuel_amount: String(indent.fuel_amount || 0),
    });
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedIndent(null);
    setDetailsEditMode(false);
  };

  const startInlineEdit = (indent) => {
    setSelectedIndent(indent);
    setDetailsEditMode(true);
    setEditForm({
      filled_date: toInputDateValue(indent.filled_date) || getToday(),
      filled_time: toInputTimeValue(indent.filled_time),
      odometer_reading: String(indent.odometer_reading || ""),
      filled_liters: String(indent.fuel_filled || 0),
      fuel_amount: String(indent.fuel_amount || 0),
    });
  };

  const cancelInlineEdit = () => {
    setDetailsEditMode(false);
    setEditForm({
      filled_date: "",
      filled_time: "",
      odometer_reading: "",
      filled_liters: "",
      fuel_amount: "",
    });
  };

  const saveInlineEdit = async (indentId) => {
    if (!editForm.filled_date) {
      showToast("Filled date is required", "warning");
      return;
    }
    if (!editForm.filled_liters || parseFloat(editForm.filled_liters) <= 0) {
      showToast("Filled liters must be greater than 0", "warning");
      return;
    }
    if (!editForm.fuel_amount || parseFloat(editForm.fuel_amount) <= 0) {
      showToast("Fuel amount must be greater than 0", "warning");
      return;
    }

    setRowActionLoadingId(indentId);
    try {
      const res = await apiPut(`/api/driver/fuel-indents/${indentId}`, {
        filled_date: editForm.filled_date,
        filled_time: editForm.filled_time,
        odometer_reading: parseInt(editForm.odometer_reading || "0", 10),
        filled_liters: parseFloat(editForm.filled_liters),
        fuel_amount: parseFloat(editForm.fuel_amount),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Fuel indent updated", "success");
        setDetailsEditMode(false);
        fetchIndents();
        setSelectedIndent((prev) =>
          prev && prev.id === indentId
            ? {
                ...prev,
                filled_date: editForm.filled_date,
                filled_time: editForm.filled_time,
                odometer_reading: parseInt(
                  editForm.odometer_reading || "0",
                  10,
                ),
                fuel_filled: parseFloat(editForm.filled_liters),
                fuel_amount: parseFloat(editForm.fuel_amount),
              }
            : prev,
        );
      } else {
        showToast(data.error || "Failed to update fuel indent", "error");
      }
    } catch {
      showToast("Failed to update fuel indent", "error");
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const deleteIndent = async (indentId) => {
    const isConfirmed = await showConfirm(
      "Delete Fuel Indent",
      "This will permanently delete this fuel indent record. Are you sure?",
    );
    if (!isConfirmed) return;
    setRowActionLoadingId(indentId);
    try {
      const res = await apiDelete(`/api/driver/fuel-indents/${indentId}`);
      const data = await res.json();
      if (res.ok) {
        showToast("Fuel indent deleted", "success");
        if (selectedIndent?.id === indentId) closeDetailsModal();
        fetchIndents();
      } else {
        showToast(data.error || "Failed to delete fuel indent", "error");
      }
    } catch {
      showToast("Failed to delete fuel indent", "error");
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const calculateStats = () => {
    const total = indents.length;
    const pending = indents.filter((i) => i.status === "pending").length;
    const totalLiters = indents.reduce(
      (sum, i) => sum + (parseFloat(i.fuel_filled) || 0),
      0,
    );
    return {total, pending, totalLiters};
  };

  const stats = calculateStats();

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primarytext">Fuel Indents</h1>
          <p className="text-sm text-secondarytext mt-0.5">
            Raise and track fuel indent requests
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus size={18} />
          Raise Indent
        </button>
      </div>

      {loading ? (
        <Loading fullScreen={false} />
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-secondarybg rounded-md border border-gray-100 p-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                <Fuel size={56} className="text-primary" />
              </div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2.5 bg-primary/10 rounded-md">
                  <Fuel size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Total Indents
                  </p>
                  <p className="text-xl font-bold text-primarytext mt-0.5">
                    {stats.total}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-secondarybg rounded-md border border-gray-100 p-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                <Clock size={56} className="text-orange-500" />
              </div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2.5 bg-orange-100 rounded-md">
                  <Clock size={20} className="text-orange-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Pending
                  </p>
                  <p className="text-xl font-bold text-primarytext mt-0.5">
                    {stats.pending}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-secondarybg rounded-md border border-gray-100 p-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                <Droplets size={56} className="text-green-500" />
              </div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2.5 bg-green-100 rounded-md">
                  <Droplets size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Total Liters
                  </p>
                  <p className="text-xl font-bold text-primarytext mt-0.5">
                    {stats.totalLiters.toFixed(1)}{" "}
                    <span className="text-sm text-secondarytext font-normal">
                      L
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Indents Table */}
          <div className="bg-secondarybg rounded-md border border-gray-100 overflow-hidden">
            <div className="px-4 sm:px-6 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-primarytext text-sm flex items-center gap-2">
                <Calendar size={16} className="text-secondarytext" />
                Fuel Indent History
              </h3>
              <span className="text-xs text-secondarytext bg-primarybg px-2 py-1 rounded-md">
                {indents.length} entries
              </span>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-100">
              {indents.length > 0 ? (
                indents.map((indent, index) => (
                  <div
                    key={indent.id}
                    className={`p-4 space-y-2.5 ${indent.status === "pending" ? "bg-pending/5" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded bg-primarybg px-2 py-0.5 text-[11px] font-bold text-secondarytext">
                          S.No {index + 1}
                        </span>
                        {indent.status === "pending" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 bg-pending/15 text-pending rounded">
                            <Clock size={10} /> Pending
                          </span>
                        )}
                        {indent.status === "completed" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 bg-green/15 text-green rounded">
                            <CheckCircle2 size={10} /> Completed
                          </span>
                        )}
                        {indent.status === "rejected" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 bg-red/15 text-red rounded">
                            <XCircle size={10} /> Rejected
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-primary text-sm">
                        {parseFloat(indent.fuel_filled || 0).toFixed(1)} L
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-primarytext">
                        {indent.vehicle_name || indent.vehicle_number}
                      </span>
                      {indent.vehicle_type && (
                        <span className="text-xs text-secondarytext bg-primarybg px-1.5 py-0.5 rounded">
                          {indent.vehicle_type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-secondarytext">
                      <span>
                        Date:{" "}
                        <span className="text-primarytext">
                          {indent.filled_date ||
                            indent.requested_at?.split("T")[0]}
                        </span>
                      </span>
                      {indent.filled_time && (
                        <span>
                          Time:{" "}
                          <span className="text-primarytext">
                            {indent.filled_time}
                          </span>
                        </span>
                      )}
                      <span>
                        Odometer:{" "}
                        <span className="font-mono text-primarytext">
                          {indent.odometer_reading}
                        </span>
                      </span>
                      <span>
                        Amount (₹):{" "}
                        <span className="font-mono text-primarytext">
                          ₹{parseFloat(indent.fuel_amount || 0).toFixed(2)}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {indent.bill_file_url ? (
                        <a
                          href={getBillURL(indent)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 font-medium hover:underline"
                        >
                          <ExternalLink size={12} /> View Bill
                        </a>
                      ) : (
                        <span className="text-secondarytext">
                          No bill uploaded
                        </span>
                      )}
                      <label className="inline-flex items-center gap-1 text-primary font-medium cursor-pointer hover:underline">
                        <Upload size={12} /> Upload Bill
                        <input
                          type="file"
                          className="hidden"
                          accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                          onChange={(e) =>
                            handleUploadBill(indent.id, e.target.files?.[0])
                          }
                        />
                      </label>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-secondarytext">
                  <AlertCircle size={32} className="opacity-20 mx-auto mb-2" />
                  <p className="text-sm">
                    No fuel indents found. Raise your first indent!
                  </p>
                </div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-primarybg border-b border-gray-100">
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      S.No
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Vehicle
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Type / Fuel
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Odometer
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Liters
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Amount (₹)
                    </th>
                    <th className="px-6 py-3.5 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Bill
                    </th>
                    <th className="px-6 py-3.5 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {indents.length > 0 ? (
                    indents.map((indent, index) => (
                      <tr
                        key={indent.id}
                        onClick={() => openDetailsModal(indent)}
                        className="cursor-pointer hover:bg-primarybg transition-colors"
                      >
                        <td className="px-6 py-3.5 whitespace-nowrap font-bold text-primarytext text-sm">
                          {index + 1}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-sm text-primarytext font-medium">
                          {indent.vehicle_name || indent.vehicle_number}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-sm text-secondarytext">
                          {indent.vehicle_type}
                          {indent.fuel_type ? ` / ${indent.fuel_type}` : ""}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-sm text-primarytext">
                          {indent.filled_date ||
                            indent.requested_at?.split("T")[0]}
                          {indent.filled_time && (
                            <span className="text-secondarytext ml-1">
                              {indent.filled_time}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-right font-mono text-secondarytext text-sm">
                          {indent.odometer_reading}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-right">
                          <span className="font-bold text-primary text-sm">
                            {parseFloat(indent.fuel_filled || 0).toFixed(1)} L
                          </span>
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-right font-mono text-secondarytext text-sm">
                          ₹{parseFloat(indent.fuel_amount || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-center text-xs text-secondarytext">
                          {indent.bill_file_url ? "Available" : "No bill"}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-center">
                          {indent.status === "pending" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 bg-pending/15 text-pending rounded">
                              <Clock size={10} /> Pending
                            </span>
                          )}
                          {indent.status === "completed" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 bg-green/15 text-green rounded">
                              <CheckCircle2 size={10} /> Completed
                            </span>
                          )}
                          {indent.status === "rejected" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 bg-red/15 text-red rounded">
                              <XCircle size={10} /> Rejected
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="9"
                        className="px-6 py-12 text-center text-secondarytext"
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <AlertCircle size={32} className="opacity-20" />
                          <p className="text-sm">
                            No fuel indents found. Raise your first indent!
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedIndent && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={closeDetailsModal}
        >
          <div
            className="bg-secondarybg rounded-md shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-md bg-primary">
                  <Fuel className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primarytext">
                    {selectedIndent.vehicle_name ||
                      selectedIndent.vehicle_number}
                  </h2>
                  <p className="text-sm text-secondarytext mt-0.5">
                    Fuel Indent #{selectedIndent.id}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedIndent.status} />
                <button
                  onClick={closeDetailsModal}
                  className="p-2 text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-primarybg rounded-md p-4">
                  <p className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                    Requested At
                  </p>
                  <p className="text-sm font-semibold text-primarytext mt-1">
                    {selectedIndent.requested_at || "-"}
                  </p>
                </div>
                <div className="bg-primarybg rounded-md p-4">
                  <p className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                    Vehicle Type
                  </p>
                  <p className="text-sm font-semibold text-primarytext mt-1">
                    {selectedIndent.vehicle_type || "-"}
                  </p>
                </div>
                <div className="bg-primarybg rounded-md p-4">
                  <p className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                    Fuel Type
                  </p>
                  <p className="text-sm font-semibold text-primarytext mt-1">
                    {selectedIndent.fuel_type || "-"}
                  </p>
                </div>
              </div>

              {detailsEditMode ? (
                <div className="bg-primarybg rounded-md p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Pencil className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-bold text-secondarytext uppercase tracking-wide">
                      Edit Fuel Entry
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-secondarytext uppercase tracking-wide">
                        Filled Date
                      </label>
                      <input
                        type="date"
                        value={editForm.filled_date}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            filled_date: e.target.value,
                          }))
                        }
                        className="mt-1 w-full h-10 px-3 border border-gray-200 rounded-md bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-secondarytext uppercase tracking-wide">
                        Filled Time
                      </label>
                      <input
                        type="time"
                        value={editForm.filled_time}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            filled_time: e.target.value,
                          }))
                        }
                        className="mt-1 w-full h-10 px-3 border border-gray-200 rounded-md bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-secondarytext uppercase tracking-wide">
                        Odometer Reading
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.odometer_reading}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            odometer_reading: e.target.value,
                          }))
                        }
                        className="mt-1 w-full h-10 px-3 border border-gray-200 rounded-md bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-secondarytext uppercase tracking-wide">
                        Filled Liters
                      </label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={editForm.filled_liters}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            filled_liters: e.target.value,
                          }))
                        }
                        className="mt-1 w-full h-10 px-3 border border-gray-200 rounded-md bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-secondarytext uppercase tracking-wide">
                        Total Amount (₹)
                      </label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.01"
                        value={editForm.fuel_amount}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            fuel_amount: e.target.value,
                          }))
                        }
                        className="mt-1 w-full h-10 px-3 border border-gray-200 rounded-md bg-white text-sm"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-primarybg rounded-md p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Droplets className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-bold text-secondarytext uppercase tracking-wide">
                      Fuel Information
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                    <DetailItem
                      label="Filled Date"
                      value={
                        selectedIndent.filled_date ||
                        selectedIndent.requested_at?.split("T")[0] ||
                        "-"
                      }
                    />
                    <DetailItem
                      label="Filled Time"
                      value={selectedIndent.filled_time || "-"}
                    />
                    <DetailItem
                      label="Odometer"
                      value={String(selectedIndent.odometer_reading ?? "-")}
                      mono
                    />
                    <DetailItem
                      label="Fuel Filled"
                      value={`${parseFloat(selectedIndent.fuel_filled || 0).toFixed(1)} L`}
                    />
                    <DetailItem
                      label="Amount (₹)"
                      value={`₹${parseFloat(selectedIndent.fuel_amount || 0).toFixed(2)}`}
                    />
                    <DetailItem
                      label="Status"
                      value={
                        selectedIndent.status
                          ? selectedIndent.status.toUpperCase()
                          : "-"
                      }
                    />
                  </div>
                </div>
              )}

              <div className="bg-primarybg rounded-md p-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                    Bill Document
                  </p>
                  <p className="text-sm text-primarytext mt-1">
                    {selectedIndent.bill_original_name || "No bill uploaded"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedIndent.bill_file_url && (
                    <a
                      href={getBillURL(selectedIndent)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
                    >
                      <ExternalLink size={12} /> View Bill
                    </a>
                  )}
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-gray-200 text-primary bg-white hover:bg-primarybg cursor-pointer">
                    <Upload size={12} />
                    {billUploadLoadingId === selectedIndent.id
                      ? "Uploading..."
                      : "Upload Bill"}
                    <input
                      type="file"
                      className="hidden"
                      accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                      onChange={(e) =>
                        handleUploadBill(selectedIndent.id, e.target.files?.[0])
                      }
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2 flex-wrap">
              {!detailsEditMode && (
                <button
                  onClick={() => startInlineEdit(selectedIndent)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  <Pencil size={13} /> Edit
                </button>
              )}
              {detailsEditMode && (
                <>
                  <button
                    onClick={cancelInlineEdit}
                    className="px-3 py-2 text-xs font-semibold rounded-md border border-gray-200 text-secondarytext hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveInlineEdit(selectedIndent.id)}
                    disabled={rowActionLoadingId === selectedIndent.id}
                    className="px-3 py-2 text-xs font-semibold rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-60"
                  >
                    {rowActionLoadingId === selectedIndent.id
                      ? "Saving..."
                      : "Save Changes"}
                  </button>
                </>
              )}
              <button
                onClick={() => deleteIndent(selectedIndent.id)}
                disabled={rowActionLoadingId === selectedIndent.id}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-60 transition-colors"
              >
                <Trash2 size={13} /> Delete
              </button>
              <button
                onClick={closeDetailsModal}
                className="px-3 py-2 text-xs font-semibold rounded-md border border-gray-200 text-secondarytext hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Raise Fuel Indent Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={closeModal}
        >
          <div
            className="bg-secondarybg rounded-md shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-primarybg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-md">
                  <Fuel size={20} className="text-primary" />
                </div>
                <h2 className="text-lg font-bold text-primarytext">
                  Raise Fuel Indent
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-primarybg rounded-md transition-colors"
              >
                <X size={20} className="text-secondarytext" />
              </button>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-5"
            >
              {/* Vehicle Type */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-primarytext">
                  Vehicle Type <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={vehicleTypeOptions}
                  value={form.vehicle_type}
                  onChange={(val) =>
                    setForm((prev) => ({
                      ...prev,
                      vehicle_type: val,
                      vehicle_id: "",
                    }))
                  }
                  placeholder="Select vehicle type"
                  emptyMessage="No vehicle types found"
                />
              </div>

              {/* Fuel Type */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-primarytext">
                  Fuel Type <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={fuelTypeOptions}
                  value={form.fuel_type}
                  onChange={(val) =>
                    setForm((prev) => ({
                      ...prev,
                      fuel_type: val,
                      vehicle_id: "",
                    }))
                  }
                  placeholder="Select fuel type"
                  emptyMessage="No fuel types"
                />
              </div>

              {/* Vehicle Name */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-primarytext">
                  Vehicle Name <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={vehicleOptions}
                  value={form.vehicle_id}
                  onChange={(val) => {
                    const selected = filteredVehicles.find(
                      (vehicle) => String(vehicle.id) === String(val),
                    );
                    setForm((prev) => ({
                      ...prev,
                      vehicle_id: val,
                      vehicle_type: selected?.vehicle_type || prev.vehicle_type,
                      fuel_type: selected?.fuel_type || prev.fuel_type,
                    }));
                  }}
                  placeholder="Search and select vehicle"
                  emptyMessage={
                    vehiclesLoading
                      ? "Loading assigned vehicles..."
                      : form.vehicle_type || form.fuel_type
                        ? "No assigned vehicles match filters"
                        : "No assigned vehicles found"
                  }
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primarytext">
                    Fuel Filled Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.filled_date}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        filled_date: e.target.value,
                      }))
                    }
                    max={getToday()}
                    className="w-full h-10.5 px-3 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primarytext">
                    Filled Time
                  </label>
                  <input
                    type="time"
                    value={form.filled_time}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        filled_time: e.target.value,
                      }))
                    }
                    className="w-full h-10.5 px-3 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                  />
                </div>
              </div>

              {/* Odometer & Liters */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primarytext">
                    Odometer Reading <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.odometer_reading}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        odometer_reading: e.target.value,
                      }))
                    }
                    className="w-full h-10.5 px-3 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    placeholder="Enter odometer reading"
                    required
                    min="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primarytext">
                    Filled Liters <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.filled_liters}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        filled_liters: e.target.value,
                      }))
                    }
                    className="w-full h-10.5 px-3 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    placeholder="Enter liters filled"
                    required
                    min="0.1"
                    step="0.1"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primarytext">
                    Total Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.fuel_amount}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        fuel_amount: e.target.value,
                      }))
                    }
                    className="w-full h-10.5 px-3 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    placeholder="Enter total amount"
                    required
                    min="0.1"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Bill Upload */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-primarytext">
                  Bill Upload (PDF/Image)
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      bill_file: e.target.files?.[0] || null,
                    }))
                  }
                  className="w-full h-10.5 px-3 py-2 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                />
                {form.bill_file && (
                  <p className="text-xs text-secondarytext">
                    Selected: {form.bill_file.name}
                  </p>
                )}
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 text-sm font-medium text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Fuel size={16} />
                      Raise Indent
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({label, value, mono = false}) {
  return (
    <div className="rounded-md border border-gray-100 bg-primarybg/60 px-3 py-2">
      <p className="text-[11px] font-semibold text-secondarytext uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={`text-sm text-primarytext ${mono ? "font-mono" : ""}`}>
        {value || "-"}
      </p>
    </div>
  );
}

function StatusBadge({status}) {
  if (status === "pending")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 bg-pending/15 text-pending rounded">
        <Clock size={10} /> Pending
      </span>
    );
  if (status === "completed")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 bg-green/15 text-green rounded">
        <CheckCircle2 size={10} /> Completed
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 bg-red/15 text-red rounded">
        <XCircle size={10} /> Rejected
      </span>
    );
  return null;
}
