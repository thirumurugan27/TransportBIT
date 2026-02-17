import React, {useState, useEffect} from "react";
import Loading from "../../../components/ui/Loading";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import CustomSearch from "../../../components/ui/CustomSearch";
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  DollarSign,
  ShoppingCart,
  Truck,
  X,
  FileText,
} from "lucide-react";
import {useToast} from "../../../context/ToastContext";
import {apiGet, apiPost, apiDelete} from "../../../utils/api";
import {showConfirm} from "../../../utils/swal";

const initialForm = {
  service_record_id: "",
  part_name: "",
  part_number: "",
  vendor_name: "",
  vendor_contact: "",
  quantity: 1,
  unit_price: 0,
  warranty_months: 0,
  invoice_number: "",
  purchased_date: "",
};

export default function PartsPurchases() {
  const {showToast} = useToast();
  const [parts, setParts] = useState([]);
  const [expenditure, setExpenditure] = useState(null);
  const [serviceRecords, setServiceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchParts();
    fetchExpenditure();
    fetchServiceRecords();
  }, []);

  const fetchParts = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/api/admin/parts");
      if (res.ok) setParts(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenditure = async () => {
    try {
      const res = await apiGet("/api/admin/parts/expenditure");
      if (res.ok) setExpenditure(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchServiceRecords = async () => {
    try {
      const res = await apiGet("/api/admin/services?status=in_progress");
      if (res.ok) {
        const inProgress = await res.json();
        const res2 = await apiGet("/api/admin/services?status=approved");
        if (res2.ok) {
          const approved = await res2.json();
          setServiceRecords([...inProgress, ...approved]);
        } else {
          setServiceRecords(inProgress);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = {
        ...form,
        service_record_id: parseInt(form.service_record_id),
        quantity: parseInt(form.quantity) || 1,
        unit_price: parseFloat(form.unit_price) || 0,
        warranty_months: parseInt(form.warranty_months) || 0,
      };
      let res;
      if (editingPart) {
        body.id = editingPart.id;
        res = await apiPost("/api/admin/services/parts/update", body);
      } else {
        res = await apiPost("/api/admin/services/parts/add", body);
      }
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Success", "success");
        closeModal();
        fetchParts();
        fetchExpenditure();
      } else {
        showToast(data.error || "Failed", "error");
      }
    } catch {
      showToast("Failed to save part", "error");
    }
  };

  const handleEdit = (part) => {
    setEditingPart(part);
    setForm({
      service_record_id: part.service_record_id,
      part_name: part.part_name,
      part_number: part.part_number || "",
      vendor_name: part.vendor_name || "",
      vendor_contact: part.vendor_contact || "",
      quantity: part.quantity,
      unit_price: part.unit_price,
      warranty_months: part.warranty_months || 0,
      invoice_number: part.invoice_number || "",
      purchased_date: part.purchased_date || "",
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm(
      "Delete Part",
      "Are you sure you want to delete this part record?",
    );
    if (!confirmed) return;
    try {
      const res = await apiDelete(`/api/admin/services/parts/delete?id=${id}`);
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        fetchParts();
        fetchExpenditure();
      } else showToast(data.error || "Failed", "error");
    } catch {
      showToast("Failed to delete", "error");
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPart(null);
    setForm(initialForm);
  };

  const filtered = parts.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.part_name?.toLowerCase().includes(q) ||
      p.vendor_name?.toLowerCase().includes(q) ||
      p.vehicle_number?.toLowerCase().includes(q) ||
      p.invoice_number?.toLowerCase().includes(q)
    );
  });

  const statsCards = expenditure
    ? [
        {
          label: "Total Spent",
          value: `₹${(expenditure.total_spent || 0).toLocaleString()}`,
          icon: DollarSign,
          color: "bg-purple-50 text-purple-600",
        },
        {
          label: "Total Parts",
          value: expenditure.total_parts || 0,
          icon: ShoppingCart,
          color: "bg-primary/10 text-primary",
        },
        {
          label: "Vehicles Served",
          value: expenditure.by_vehicle?.length || 0,
          icon: Truck,
          color: "bg-green-50 text-green-600",
        },
      ]
    : [];

  if (loading && parts.length === 0) return <Loading fullScreen={false} />;

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Stats Cards */}
      {statsCards.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {statsCards.map((stat, i) => (
            <div
              key={i}
              className="bg-secondarybg rounded-md p-5 border border-primarybg shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-secondarytext uppercase tracking-wider mb-2">
                    {stat.label}
                  </p>
                  <h3 className="text-2xl font-extrabold text-primarytext">
                    {stat.value}
                  </h3>
                </div>
                <div className={"p-3 rounded-md shadow-sm " + stat.color}>
                  <stat.icon size={24} strokeWidth={2.5} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vehicle Expenditure */}
      {expenditure?.by_vehicle?.length > 0 && (
        <div className="bg-secondarybg rounded-md border border-primarybg shadow-sm p-5">
          <h3 className="text-xs font-bold text-secondarytext uppercase tracking-wider mb-4">
            Expenditure by Vehicle
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {expenditure.by_vehicle.map((v) => (
              <div
                key={v.vehicle_id}
                className="bg-primarybg rounded-md p-3 border border-primarybg"
              >
                <p className="font-medium text-primarytext text-sm">
                  {v.vehicle_number}
                </p>
                <p className="text-primary font-bold text-sm mt-1">
                  ₹{v.total_spent?.toLocaleString()}
                </p>
                <p className="text-xs text-secondarytext mt-0.5">
                  {v.parts_count} parts
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-secondarybg p-5 rounded-md border border-primarybg shadow-sm">
        <div className="w-full sm:w-auto">
          <CustomSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by part, vendor, vehicle..."
          />
        </div>
        <button
          onClick={() => {
            setEditingPart(null);
            setForm(initialForm);
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-md hover:bg-primary/90 transition-all shadow-md hover:shadow-lg text-sm font-semibold whitespace-nowrap"
        >
          <Plus size={18} strokeWidth={2.5} />
          Add Part Purchase
        </button>
      </div>

      {/* Table */}
      <div className="bg-secondarybg rounded-md border border-primarybg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primarybg border-b border-primarybg">
                {[
                  "Part Name",
                  "Vehicle",
                  "Service",
                  "Vendor",
                  "Qty",
                  "Unit Price",
                  "Total",
                  "Invoice",
                  "Date",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-bold text-secondarytext uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-primarybg">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="bg-primarybg p-4 rounded-full">
                        <FileText
                          size={32}
                          className="text-secondarytext"
                          strokeWidth={1.5}
                        />
                      </div>
                      <p className="text-secondarytext font-medium">
                        No parts purchased yet
                      </p>
                      <p className="text-secondarytext text-sm">
                        Add a part purchase to get started
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-primarybg transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-primarytext">
                        {p.part_name}
                      </div>
                      {p.part_number && (
                        <div className="text-xs text-secondarytext">
                          {p.part_number}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-secondarytext">
                      {p.vehicle_name
                        ? `${p.vehicle_name} (${p.vehicle_number})`
                        : p.vehicle_number || "-"}
                    </td>
                    <td className="px-4 py-3 text-secondarytext text-xs max-w-[150px] truncate">
                      {p.service_title || "-"}
                    </td>
                    <td className="px-4 py-3 text-secondarytext">
                      {p.vendor_name || "-"}
                    </td>
                    <td className="px-4 py-3 text-primarytext">{p.quantity}</td>
                    <td className="px-4 py-3 text-primarytext">
                      ₹{p.unit_price?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-primary">
                      ₹{p.total_price?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-secondarytext text-xs">
                      {p.invoice_number || "-"}
                    </td>
                    <td className="px-4 py-3 text-secondarytext text-xs">
                      {p.purchased_date || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(p)}
                          className="p-1.5 hover:bg-primarybg rounded-md transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={15} className="text-secondarytext" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={15} className="text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={closeModal}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-primarybg flex justify-between items-center">
              <h3 className="text-lg font-bold text-primarytext">
                {editingPart ? "Edit Part" : "Add Part Purchase"}
              </h3>
              <button
                onClick={closeModal}
                className="text-secondarytext hover:text-primarytext transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {!editingPart && (
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Service Record
                  </label>
                  <SearchableSelect
                    value={form.service_record_id}
                    onChange={(val) =>
                      setForm({...form, service_record_id: val})
                    }
                    placeholder="Select Service Record"
                    options={serviceRecords.map((sr) => {
                      const vehicleLabel = sr.vehicle_name
                        ? `${sr.vehicle_name} (${sr.vehicle_number})`
                        : sr.vehicle_number;
                      return {
                        value: sr.id,
                        label: vehicleLabel,
                        subtitle: sr.title,
                      };
                    })}
                    emptyMessage="No active service records"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Part Name
                  </label>
                  <input
                    type="text"
                    value={form.part_name}
                    onChange={(e) =>
                      setForm({...form, part_name: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Part name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Part Number
                  </label>
                  <input
                    type="text"
                    value={form.part_number}
                    onChange={(e) =>
                      setForm({...form, part_number: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Part number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Vendor Name
                  </label>
                  <input
                    type="text"
                    value={form.vendor_name}
                    onChange={(e) =>
                      setForm({...form, vendor_name: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Vendor"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Vendor Contact
                  </label>
                  <input
                    type="text"
                    value={form.vendor_contact}
                    onChange={(e) =>
                      setForm({...form, vendor_contact: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Contact"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={form.quantity}
                    onChange={(e) =>
                      setForm({...form, quantity: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Unit Price (₹)
                  </label>
                  <input
                    type="number"
                    value={form.unit_price}
                    onChange={(e) =>
                      setForm({...form, unit_price: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Total
                  </label>
                  <div className="h-[42px] px-3 bg-primary/5 border border-primary/20 rounded-md flex items-center">
                    <span className="text-sm font-bold text-primary">
                      ₹
                      {(
                        (parseInt(form.quantity) || 1) *
                        (parseFloat(form.unit_price) || 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Warranty (Months)
                  </label>
                  <input
                    type="number"
                    value={form.warranty_months}
                    onChange={(e) =>
                      setForm({...form, warranty_months: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Invoice No.
                  </label>
                  <input
                    type="text"
                    value={form.invoice_number}
                    onChange={(e) =>
                      setForm({...form, invoice_number: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="INV-XXX"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={form.purchased_date}
                    onChange={(e) =>
                      setForm({...form, purchased_date: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-white rounded-md py-2.5 font-semibold hover:bg-primary/90 transition-all shadow-md hover:shadow-lg"
              >
                {editingPart ? "Update Part" : "Add Part Purchase"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
