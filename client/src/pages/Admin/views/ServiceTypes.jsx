import React, {useState, useEffect} from "react";
import Loading from "../../../components/ui/Loading";
import {Plus, Edit2, Trash2, X, Settings, Clock} from "lucide-react";
import {useToast} from "../../../context/ToastContext";
import {apiGet, apiPost, apiDelete} from "../../../utils/api";
import {showConfirm} from "../../../utils/swal";

const initialForm = {
  name: "",
  description: "",
  estimated_duration_hours: "",
};

export default function ServiceTypes() {
  const {showToast} = useToast();
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/api/admin/service-types");
      if (res.ok) setTypes(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = {
        ...form,
        estimated_duration_hours:
          parseFloat(form.estimated_duration_hours) || 0,
      };
      let res;
      if (editingType) {
        body.id = editingType.id;
        res = await apiPost("/api/admin/service-types/update", body);
      } else {
        res = await apiPost("/api/admin/service-types/create", body);
      }
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Success", "success");
        closeModal();
        fetchTypes();
      } else {
        showToast(data.error || "Failed", "error");
      }
    } catch {
      showToast("Failed to save", "error");
    }
  };

  const handleEdit = (type) => {
    setEditingType(type);
    setForm({
      name: type.name,
      description: type.description || "",
      estimated_duration_hours: type.estimated_duration_hours || "",
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm("Delete Service Type", "Are you sure?");
    if (!confirmed) return;
    try {
      const res = await apiDelete(`/api/admin/service-types/delete?id=${id}`);
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        fetchTypes();
      } else showToast(data.error || "Failed", "error");
    } catch {
      showToast("Failed to delete", "error");
    }
  };

  const handleToggleActive = async (type) => {
    try {
      const res = await apiPost("/api/admin/service-types/update", {
        id: type.id,
        name: type.name,
        description: type.description,
        estimated_duration_hours: type.estimated_duration_hours,
        is_active: !type.is_active,
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Updated", "success");
        fetchTypes();
      } else showToast(data.error || "Failed", "error");
    } catch {
      showToast("Failed to update", "error");
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingType(null);
    setForm(initialForm);
  };

  if (loading) return <Loading fullScreen={false} />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primarytext">Service Types</h1>
          <p className="text-secondarytext text-sm mt-0.5">
            Manage master list of service and repair categories
          </p>
        </div>
        <button
          onClick={() => {
            setEditingType(null);
            setForm(initialForm);
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus size={18} />
          Add Service Type
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {types.length === 0 ? (
          <div className="col-span-full text-center py-12 text-secondarytext bg-secondarybg rounded-md border border-gray-100">
            No service types found. Add your first service type.
          </div>
        ) : (
          types.map((type) => (
            <div
              key={type.id}
              className={`bg-secondarybg rounded-md border p-4 transition-all hover:shadow-sm ${
                type.is_active ? "border-gray-100" : "border-red-200 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-primary/10 rounded-md flex items-center justify-center">
                    <Settings size={16} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-primarytext text-sm">
                      {type.name}
                    </h3>
                    {!type.is_active && (
                      <span className="text-[10px] text-red-500 font-semibold uppercase tracking-wider">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => handleEdit(type)}
                    className="p-1.5 hover:bg-primarybg rounded-md transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={14} className="text-secondarytext" />
                  </button>
                  <button
                    onClick={() => handleDelete(type.id)}
                    className="p-1.5 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                </div>
              </div>
              <p className="text-secondarytext text-xs mb-3 line-clamp-2">
                {type.description || "No description"}
              </p>
              <div className="flex items-center justify-between">
                {type.estimated_duration_hours > 0 ? (
                  <div className="flex items-center gap-1 text-xs text-secondarytext">
                    <Clock size={12} />
                    <span>~{type.estimated_duration_hours}h</span>
                  </div>
                ) : (
                  <div />
                )}
                <button
                  onClick={() => handleToggleActive(type)}
                  className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    type.is_active
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : "bg-red-100 text-red-700 hover:bg-red-200"
                  }`}
                >
                  {type.is_active ? "Active" : "Inactive"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={closeModal}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl max-w-md w-full animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-primarytext">
                {editingType ? "Edit Service Type" : "Add Service Type"}
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
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({...form, name: e.target.value})}
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="e.g., Oil Change"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({...form, description: e.target.value})
                  }
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  rows={3}
                  placeholder="Brief description"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Estimated Duration (hours)
                </label>
                <input
                  type="number"
                  value={form.estimated_duration_hours}
                  onChange={(e) =>
                    setForm({...form, estimated_duration_hours: e.target.value})
                  }
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  step="0.5"
                  min="0"
                  placeholder="e.g., 2"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-primary text-white rounded-md py-2.5 font-medium hover:bg-primary/90 transition-colors"
              >
                {editingType ? "Update" : "Create Service Type"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
