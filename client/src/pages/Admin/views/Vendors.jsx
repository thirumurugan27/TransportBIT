import React, {useState, useEffect} from "react";
import Loading from "../../../components/ui/Loading";
import CustomSearch from "../../../components/ui/CustomSearch";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  IndianRupee,
  Package,
  Store,
} from "lucide-react";
import {useToast} from "../../../context/ToastContext";
import {apiGet, apiPost, apiDelete} from "../../../utils/api";
import {showConfirm} from "../../../utils/swal";

const initialForm = {
  name: "",
  address: "",
  contact: "",
  gst_number: "",
  email: "",
};

export default function Vendors() {
  const {showToast} = useToast();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetail, setShowDetail] = useState(null);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/api/admin/vendors?include_inactive=true");
      if (res.ok) setVendors(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = {...form};
      let res;
      if (editingVendor) {
        body.id = editingVendor.id;
        res = await apiPost("/api/admin/vendors/update", body);
      } else {
        res = await apiPost("/api/admin/vendors/create", body);
      }
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Success", "success");
        closeModal();
        fetchVendors();
      } else {
        showToast(data.error || "Failed", "error");
      }
    } catch {
      showToast("Failed to save vendor", "error");
    }
  };

  const handleEdit = (vendor) => {
    setEditingVendor(vendor);
    setForm({
      name: vendor.name || "",
      address: vendor.address || "",
      contact: vendor.contact || "",
      gst_number: vendor.gst_number || "",
      email: vendor.email || "",
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm(
      "Delete Vendor",
      "This will deactivate the vendor. Parts linked to this vendor will not be affected.",
    );
    if (!confirmed) return;
    try {
      const res = await apiDelete(`/api/admin/vendors/delete?id=${id}`);
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        fetchVendors();
      } else showToast(data.error || "Failed", "error");
    } catch {
      showToast("Failed to delete", "error");
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingVendor(null);
    setForm(initialForm);
  };

  const filtered = vendors.filter((v) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.name?.toLowerCase().includes(q) ||
      v.contact?.toLowerCase().includes(q) ||
      v.email?.toLowerCase().includes(q) ||
      v.address?.toLowerCase().includes(q) ||
      v.gst_number?.toLowerCase().includes(q)
    );
  });

  const activeVendors = vendors.filter((v) => v.is_active);
  const totalSpent = vendors.reduce((sum, v) => sum + (v.total_spent || 0), 0);
  const totalParts = vendors.reduce((sum, v) => sum + (v.parts_count || 0), 0);

  const statsCards = [
    {
      label: "Total Vendors",
      value: activeVendors.length,
      icon: Store,
      color: "bg-primary/10 text-primary",
    },
    {
      label: "Total Spent",
      value: `₹${totalSpent.toLocaleString()}`,
      icon: IndianRupee,
      color: "bg-purple-50 text-purple-600",
    },
    {
      label: "Total Parts Supplied",
      value: totalParts,
      icon: Package,
      color: "bg-green-50 text-green-600",
    },
  ];

  if (loading && vendors.length === 0) return <Loading fullScreen={false} />;

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Stats Cards */}
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

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-secondarybg p-5 rounded-md border border-primarybg shadow-sm">
        <div className="w-full sm:w-auto">
          <CustomSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search vendors..."
          />
        </div>
        <button
          onClick={() => {
            setEditingVendor(null);
            setForm(initialForm);
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-md hover:bg-primary/90 transition-all shadow-md hover:shadow-lg text-sm font-semibold whitespace-nowrap"
        >
          <Plus size={18} strokeWidth={2.5} />
          Add Vendor
        </button>
      </div>

      {/* Vendors Table */}
      <div className="bg-secondarybg rounded-md border border-primarybg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primarybg border-b border-primarybg">
                {[
                  "Vendor",
                  "Address",
                  "Contact",
                  "GST Number",
                  "Parts Supplied",
                  "Total Spent",
                  "Status",
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
                  <td colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="bg-primarybg p-4 rounded-full">
                        <Building2
                          size={32}
                          className="text-secondarytext"
                          strokeWidth={1.5}
                        />
                      </div>
                      <p className="text-secondarytext font-medium">
                        No vendors found
                      </p>
                      <p className="text-secondarytext text-sm">
                        Add a vendor to get started
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((v) => (
                  <tr
                    key={v.id}
                    className="hover:bg-primarybg transition-colors cursor-pointer"
                    onClick={() => setShowDetail(v)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-primarytext">
                        {v.name}
                      </div>
                      {v.email && (
                        <div className="text-xs text-secondarytext flex items-center gap-1 mt-0.5">
                          <Mail size={11} />
                          {v.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-secondarytext text-xs max-w-[200px]">
                      {v.address ? (
                        <div className="flex items-start gap-1">
                          <MapPin size={12} className="mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{v.address}</span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-secondarytext">
                      {v.contact || "-"}
                    </td>
                    <td className="px-4 py-3 text-secondarytext text-xs">
                      {v.gst_number || "-"}
                    </td>
                    <td className="px-4 py-3 text-primarytext font-medium">
                      {v.parts_count || 0}
                    </td>
                    <td className="px-4 py-3 font-medium text-primary">
                      ₹{(v.total_spent || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          v.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {v.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(v)}
                          className="p-1.5 hover:bg-primarybg rounded-md transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={15} className="text-secondarytext" />
                        </button>
                        {v.is_active && (
                          <button
                            onClick={() => handleDelete(v.id)}
                            className="p-1.5 hover:bg-red-50 rounded-md transition-colors"
                            title="Deactivate"
                          >
                            <Trash2 size={15} className="text-red-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vendor Detail Modal */}
      {showDetail && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setShowDetail(null)}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl max-w-md w-full animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-primarybg flex justify-between items-center">
              <h3 className="text-lg font-bold text-primarytext">
                Vendor Details
              </h3>
              <button
                onClick={() => setShowDetail(null)}
                className="text-secondarytext hover:text-primarytext transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-primary/10 p-3 rounded-md">
                  <Building2 size={24} className="text-primary" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-primarytext">
                    {showDetail.name}
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      showDetail.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {showDetail.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                {showDetail.address && (
                  <div className="flex items-start gap-3 bg-primarybg p-3 rounded-md">
                    <MapPin
                      size={16}
                      className="text-secondarytext mt-0.5 shrink-0"
                    />
                    <div>
                      <p className="text-xs font-bold text-secondarytext uppercase tracking-wider mb-1">
                        Address
                      </p>
                      <p className="text-primarytext">{showDetail.address}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-primarybg p-3 rounded-md">
                    <div className="flex items-center gap-2 mb-1">
                      <Phone size={14} className="text-secondarytext" />
                      <p className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Contact
                      </p>
                    </div>
                    <p className="text-primarytext font-medium">
                      {showDetail.contact || "-"}
                    </p>
                  </div>
                  <div className="bg-primarybg p-3 rounded-md">
                    <div className="flex items-center gap-2 mb-1">
                      <Mail size={14} className="text-secondarytext" />
                      <p className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Email
                      </p>
                    </div>
                    <p className="text-primarytext font-medium text-xs break-all">
                      {showDetail.email || "-"}
                    </p>
                  </div>
                </div>

                {showDetail.gst_number && (
                  <div className="bg-primarybg p-3 rounded-md">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText size={14} className="text-secondarytext" />
                      <p className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                        GST Number
                      </p>
                    </div>
                    <p className="text-primarytext font-medium">
                      {showDetail.gst_number}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-primary/5 border border-primary/20 p-3 rounded-md text-center">
                    <p className="text-2xl font-extrabold text-primary">
                      {showDetail.parts_count || 0}
                    </p>
                    <p className="text-xs text-secondarytext font-semibold uppercase">
                      Parts Supplied
                    </p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 p-3 rounded-md text-center">
                    <p className="text-2xl font-extrabold text-purple-600">
                      ₹{(showDetail.total_spent || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-secondarytext font-semibold uppercase">
                      Total Spent
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowDetail(null);
                    handleEdit(showDetail);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-white rounded-md py-2.5 font-semibold hover:bg-primary/90 transition-all text-sm"
                >
                  <Edit2 size={15} />
                  Edit Vendor
                </button>
                <button
                  onClick={() => setShowDetail(null)}
                  className="px-6 py-2.5 border border-gray-200 text-secondarytext rounded-md hover:bg-primarybg transition-all text-sm font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                {editingVendor ? "Edit Vendor" : "Add Vendor"}
              </h3>
              <button
                onClick={closeModal}
                className="text-secondarytext hover:text-primarytext transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Vendor Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({...form, name: e.target.value})}
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Enter vendor name"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Address
                </label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({...form, address: e.target.value})}
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Full address (street, city, state, pincode)"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    value={form.contact}
                    onChange={(e) =>
                      setForm({...form, contact: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({...form, email: e.target.value})}
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="vendor@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  GST Number
                </label>
                <input
                  type="text"
                  value={form.gst_number}
                  onChange={(e) =>
                    setForm({...form, gst_number: e.target.value})
                  }
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="GSTIN (optional)"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-white rounded-md py-2.5 font-semibold hover:bg-primary/90 transition-all shadow-md hover:shadow-lg"
              >
                {editingVendor ? "Update Vendor" : "Add Vendor"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
