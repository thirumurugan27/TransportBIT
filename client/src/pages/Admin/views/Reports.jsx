import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  ClipboardList,
  Wrench,
  ShoppingCart,
  Bus,
  Users,
  Truck,
  Fuel,
  GraduationCap,
  FileText,
  ChevronDown,
  Loader2,
  ArrowRightLeft,
  MapPin,
  FileDown,
} from "lucide-react";
import { API_BASE } from "../../../utils/api";

/* ─── Report Definitions ─── */
const REPORTS = [
  {
    key: "attendance",
    title: "Attendance Report",
    description: "Daily attendance records with check-in/out times for all drivers",
    icon: ClipboardList,
    color: "bg-green/10 text-green",
    endpoint: "/api/admin/reports/attendance",
    filters: ["dateRange"],
  },
  {
    key: "service",
    title: "Service Records",
    description: "Vehicle service history with cost breakdown, severity & workshop details",
    icon: Wrench,
    color: "bg-primary/10 text-primary",
    endpoint: "/api/admin/reports/service",
    filters: ["dateRange", "serviceStatus"],
  },
  {
    key: "purchase",
    title: "Purchase & Bills",
    description: "Parts purchased, vendor-wise spending, invoice tracking & warranty details",
    icon: ShoppingCart,
    color: "bg-pending/10 text-pending",
    endpoint: "/api/admin/reports/purchase",
    filters: ["dateRange"],
  },
  {
    key: "leave",
    title: "Leave Report",
    description: "Driver leave requests with type, duration, approval status & remarks",
    icon: Calendar,
    color: "bg-customblue/10 text-customblue",
    endpoint: "/api/admin/reports/leave",
    filters: ["dateRange"],
  },
  {
    key: "km-fuel",
    title: "KM & Fuel Report",
    description: "KM logs with fuel consumption, mileage calculations per driver & vehicle",
    icon: Fuel,
    color: "bg-red/10 text-red",
    endpoint: "/api/admin/reports/km-fuel",
    filters: ["dateRange"],
  },
  {
    key: "vehicle-fleet",
    title: "Vehicle Fleet Report",
    description: "Complete fleet inventory with document expiry status (Insurance, FC, Permit)",
    icon: Truck,
    color: "bg-primary/10 text-primary",
    endpoint: "/api/admin/reports/vehicle-fleet",
    filters: [],
  },
  {
    key: "student-fee",
    title: "Student Fee Collection",
    description: "Transport fee collection, paid vs outstanding balance per student",
    icon: GraduationCap,
    color: "bg-green/10 text-green",
    endpoint: "/api/admin/reports/student-fee",
    filters: ["academicYear"],
  },
  {
    key: "vehicle-requests",
    title: "Faculty Vehicle Requests",
    description: "Faculty vehicle booking requests with trip details, assigned vehicles & drivers",
    icon: Bus,
    color: "bg-pending/10 text-pending",
    endpoint: "/api/admin/reports/vehicle-requests",
    filters: ["dateRange"],
  },
  {
    key: "drivers",
    title: "Driver Master Report",
    description: "Complete driver directory with license details, expiry status & home assignments",
    icon: Users,
    color: "bg-customblue/10 text-customblue",
    endpoint: "/api/admin/reports/drivers",
    filters: [],
  },
  {
    key: "assignments",
    title: "Assignment Report",
    description: "Driver-vehicle assignment history with shift, dates & temporary replacements",
    icon: FileText,
    color: "bg-red/10 text-red",
    endpoint: "/api/admin/reports/assignments",
    filters: ["dateRange"],
  },
  {
    key: "vendor",
    title: "Vendor Spending Report",
    description: "Vendor-wise spending analysis with parts count & vehicles served",
    icon: ShoppingCart,
    color: "bg-primary/10 text-primary",
    endpoint: "/api/admin/reports/vendor",
    filters: ["dateRange"],
  },
  {
    key: "stop-changes",
    title: "Stop Change Report",
    description: "Student stop change requests with fee adjustments, settlement details & approval status",
    icon: ArrowRightLeft,
    color: "bg-pending/10 text-pending",
    endpoint: "/api/admin/reports/stop-changes",
    filters: ["dateRange"],
  },
  {
    key: "bus-detail",
    title: "Bus Detail Report",
    description: "Complete bus report with vehicle info, stops & fees, all students, payments & balances",
    icon: MapPin,
    color: "bg-customblue/10 text-customblue",
    endpoint: "/api/admin/reports/bus-detail",
    filters: ["busSelect"],
  },
];

const SERVICE_STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "reported", label: "Reported" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

/* ─── Helper: generate academic year options ─── */
function getAcademicYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear + 1; y >= currentYear - 4; y--) {
    years.push(`${y}-${y + 1}`);
  }
  return years;
}

/* ─── Helper: default date range (last 30 days) ─── */
function getDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    start_date: start.toISOString().split("T")[0],
    end_date: end.toISOString().split("T")[0],
  };
}

export default function Reports() {
  const defaults = getDefaultDates();
  const [filters, setFilters] = useState({
    start_date: defaults.start_date,
    end_date: defaults.end_date,
    academic_year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    status: "all",
    bus_id: "",
  });
  const [downloading, setDownloading] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);
  const [buses, setBuses] = useState([]);
  const [reportFormat, setReportFormat] = useState({}); // { [reportKey]: "excel" | "pdf" }

  // Fetch buses for bus-detail report
  useEffect(() => {
    const fetchBuses = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/buses/with-students`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setBuses(data || []);
        }
      } catch (err) {
        console.error("Failed to fetch buses:", err);
      }
    };
    fetchBuses();
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const getFormat = (reportKey) => reportFormat[reportKey] || "excel";

  const handleDownload = async (report) => {
    // For bus-detail, require bus selection
    if (report.filters.includes("busSelect") && !filters.bus_id) {
      alert("Please select a bus first");
      return;
    }

    setDownloading(report.key);
    try {
      const params = new URLSearchParams();
      const format = getFormat(report.key);

      if (report.filters.includes("dateRange")) {
        params.set("start_date", filters.start_date);
        params.set("end_date", filters.end_date);
      }
      if (report.filters.includes("academicYear")) {
        params.set("academic_year", filters.academic_year);
      }
      if (report.filters.includes("serviceStatus") && filters.status !== "all") {
        params.set("status", filters.status);
      }
      if (report.filters.includes("busSelect") && filters.bus_id) {
        params.set("bus_id", filters.bus_id);
      }
      if (format === "pdf") {
        params.set("format", "pdf");
      }

      const url = `${API_BASE}${report.endpoint}?${params.toString()}`;
      const res = await fetch(url, {
        credentials: "include",
        headers: { "X-Tunnel-Skip-Efficiency-Check": "true" },
      });

      if (!res.ok) {
        try {
          const err = await res.json();
          alert(err.error || "Failed to generate report");
        } catch {
          alert("Failed to generate report");
        }
        return;
      }

      const blob = await res.blob();
      console.log("Report blob size:", blob.size, "type:", blob.type);
      const disposition = res.headers.get("Content-Disposition");
      const ext = format === "pdf" ? ".pdf" : ".xlsx";
      let filename = `${report.key}_report${ext}`;
      if (disposition) {
        const match = disposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      const link = document.createElement("a");
      const blobWithType = format === "pdf" 
        ? new Blob([await blob.arrayBuffer()], { type: "application/pdf" })
        : blob;
      link.href = URL.createObjectURL(blobWithType);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("Report download error:", err);
      alert("Failed to download report. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-primary" />
            Reports
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate and download Excel reports for attendance, service, billing & more
          </p>
        </div>
      </div>

      {/* Global Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Report Filters
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Start Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => handleFilterChange("start_date", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>
          {/* End Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => handleFilterChange("end_date", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>
          {/* Academic Year */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Academic Year</label>
            <select
              value={filters.academic_year}
              onChange={(e) => handleFilterChange("academic_year", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
            >
              {getAcademicYears().map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {/* Service Status */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Service Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
            >
              {SERVICE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          {/* Bus Select */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Bus (for Bus Detail)</label>
            <select
              value={filters.bus_id}
              onChange={(e) => handleFilterChange("bus_id", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
            >
              <option value="">Select a bus</option>
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || `Bus #${b.id}`}{b.route ? ` (${b.route})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          const isDownloading = downloading === report.key;
          const isExpanded = expandedCard === report.key;

          return (
            <div
              key={report.key}
              className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-200 overflow-hidden"
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${report.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 text-sm">{report.title}</h3>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        {report.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Filter Chips */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {report.filters.includes("dateRange") && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-100">
                      <Calendar className="w-3 h-3" />
                      {filters.start_date} → {filters.end_date}
                    </span>
                  )}
                  {report.filters.includes("academicYear") && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-100">
                      <GraduationCap className="w-3 h-3" />
                      {filters.academic_year}
                    </span>
                  )}
                  {report.filters.includes("serviceStatus") && filters.status !== "all" && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-100">
                      <Wrench className="w-3 h-3" />
                      {filters.status}
                    </span>
                  )}
                  {report.filters.includes("busSelect") && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-100">
                      <Bus className="w-3 h-3" />
                      {filters.bus_id
                        ? buses.find((b) => String(b.id) === String(filters.bus_id))?.name || `Bus #${filters.bus_id}`
                        : "Select a bus"}
                    </span>
                  )}
                  {report.filters.length === 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-green/5 text-green border border-green/10">
                      No filters needed — full data
                    </span>
                  )}
                </div>

                {/* Format Toggle + Download */}
                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                    <button
                      onClick={() => setReportFormat((prev) => ({ ...prev, [report.key]: "excel" }))}
                      className={`px-3 py-2 font-medium transition-colors ${
                        getFormat(report.key) === "excel"
                          ? "bg-green/10 text-green border-r border-gray-200"
                          : "bg-white text-gray-500 hover:bg-gray-50 border-r border-gray-200"
                      }`}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 inline mr-1" />
                      Excel
                    </button>
                    <button
                      onClick={() => setReportFormat((prev) => ({ ...prev, [report.key]: "pdf" }))}
                      className={`px-3 py-2 font-medium transition-colors ${
                        getFormat(report.key) === "pdf"
                          ? "bg-red/10 text-red"
                          : "bg-white text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      <FileDown className="w-3.5 h-3.5 inline mr-1" />
                      PDF
                    </button>
                  </div>
                  <button
                    onClick={() => handleDownload(report)}
                    disabled={isDownloading}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                      ${isDownloading
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-primary text-white hover:bg-primary/90 active:scale-[0.98] shadow-sm hover:shadow"
                      }`}
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download {getFormat(report.key) === "pdf" ? "PDF" : "Excel"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Footer */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <FileSpreadsheet className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-800">About Reports</p>
          <p className="text-xs text-blue-600 mt-1 leading-relaxed">
            Reports can be generated as Excel (.xlsx) or PDF files with formatted headers, styled columns and auto-calculated totals.
            PDF reports include the institution header with Bannari Amman Institute of Technology branding.
            Adjust the date range or filters above before downloading. Vehicle Fleet and Driver reports export the complete current data.
          </p>
        </div>
      </div>
    </div>
  );
}
