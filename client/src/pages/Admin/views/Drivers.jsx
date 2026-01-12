import React, {useState, useEffect} from "react";
import CreateDriver from "../CreateDriver";
import {
  Plus,
  Trash2,
  Search,
  User,
  CheckCircle,
  XOutput,
  Users,
  Loader2,
  Mail,
  Phone,
  FileText,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function Drivers() {
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/drivers`);
      const data = await res.json();
      setDrivers(data || []);
    } catch (err) {
      console.error("Error fetching drivers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this driver?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/drivers/delete?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        alert("Driver deleted!");
        fetchDrivers();
      } else {
        alert("Failed to delete driver: " + (await res.text()));
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleModalClose = () => {
    setShowCreateModal(false);
    fetchDrivers();
  };

  const filteredDrivers = drivers.filter(
    (d) =>
      d.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.license_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="text-[var(--color-primary)]" />
            Driver Management
          </h1>
          <p className="text-sm text-gray-500">
            Manage your driver fleet and assignments
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white rounded-lg transition-colors font-medium flex items-center gap-2 shadow-sm"
        >
          <Plus size={18} />
          Create Driver
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-gray-800">All Drivers</h3>

          <div className="relative w-full sm:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Search drivers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-500">
            <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin mb-3" />
            <p>Loading drivers...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    License Details
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Contact Info
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Experience
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDrivers && filteredDrivers.length > 0 ? (
                  filteredDrivers.map((d) => (
                    <tr
                      key={d.id}
                      className="hover:bg-gray-50/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">
                            {d.full_name?.charAt(0) || <User size={16} />}
                          </div>
                          <span className="font-semibold text-gray-800">
                            {d.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <FileText size={14} className="text-gray-400" />
                          <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                            {d.license_number}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone size={12} className="text-gray-400" />{" "}
                            {d.phone}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Mail size={12} className="text-gray-400" />{" "}
                            {d.email || "No email"}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {d.experience_years ? (
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold">
                            {d.experience_years} Years
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wide border ${
                            d.status === "present"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : "bg-red-50 text-red-700 border-red-100"
                          }`}
                        >
                          {d.status === "present" ? (
                            <CheckCircle size={12} />
                          ) : (
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          )}
                          {d.status || "Offline"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                          onClick={() => handleDelete(d.id)}
                          title="Delete Driver"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-6 py-16 text-center text-gray-400"
                    >
                      <User size={48} className="mx-auto mb-3 opacity-20" />
                      <p>No drivers found matching your criteria</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && <CreateDriver onClose={handleModalClose} />}
    </div>
  );
}
