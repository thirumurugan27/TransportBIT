import React, {useState, useEffect, useCallback, useRef} from "react";
import Loading from "../../../components/ui/Loading";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import CustomSearch from "../../../components/ui/CustomSearch";
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  IndianRupee,
  ShoppingCart,
  Truck,
  X,
  Store,
  ChevronDown,
  ChevronRight,
  Clock,
  PackageCheck,
  Undo2,
  Calendar,
  User,
  Shield,
  XCircle,
  ArrowRight,
  FileText,
  ClipboardList,
  Hash,
  Upload,
  Download,
  Eye,
  Image,
  File,
  Paperclip,
  Loader2,
} from "lucide-react";
import {useToast} from "../../../context/ToastContext";
import {
  apiGet,
  apiPost,
  apiDelete,
  apiUpload,
  API_BASE,
} from "../../../utils/api";
import {showConfirm} from "../../../utils/swal";
import {jsPDF} from "jspdf";

const STATUS_OPTIONS = [
  {
    value: "pending",
    label: "Pending",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    dotColor: "bg-amber-500",
    icon: Clock,
  },
  {
    value: "received",
    label: "Received",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dotColor: "bg-emerald-500",
    icon: PackageCheck,
  },
  {
    value: "returned",
    label: "Returned",
    color: "bg-violet-100 text-violet-700 border-violet-200",
    dotColor: "bg-violet-500",
    icon: Undo2,
  },
  {
    value: "cancelled",
    label: "Cancelled",
    color: "bg-red-100 text-red-700 border-red-200",
    dotColor: "bg-red-500",
    icon: XCircle,
  },
];

const getStatusBadge = (status) => {
  const opt =
    STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
  const Icon = opt.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${opt.color}`}
    >
      <Icon size={12} />
      {opt.label}
    </span>
  );
};

const emptyProductRow = {
  part_name: "",
  quantity: 1,
  unit_price: 0,
  warranty_months: 0,
};

const toInputDate = (d) => {
  if (!d || d === "-") return "";
  const parts = d.split("-");
  if (parts.length === 3 && parts[2].length === 4)
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return d;
};

export default function PartsPurchases() {
  const {showToast} = useToast();
  const [orders, setOrders] = useState([]);
  const [expenditure, setExpenditure] = useState(null);
  const [serviceRecords, setServiceRecords] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedOrders, setExpandedOrders] = useState({});

  // Create order modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    service_record_id: "",
    vendor_id: "",
    invoice_number: "",
    purchased_date: "",
    status: "pending",
    notes: "",
  });
  const [bulkProducts, setBulkProducts] = useState([{...emptyProductRow}]);

  // Order detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Edit order modal
  const [showEditOrderModal, setShowEditOrderModal] = useState(false);
  const [editOrderForm, setEditOrderForm] = useState({
    id: "",
    vendor_id: "",
    invoice_number: "",
    purchased_date: "",
    notes: "",
  });

  // Edit product modal
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editProductForm, setEditProductForm] = useState({
    id: "",
    part_name: "",
    quantity: 1,
    unit_price: 0,
    warranty_months: 0,
    status: "pending",
    ordered_date: "",
    received_date: "",
    returned_date: "",
    cancelled_date: "",
  });

  // Add product to order modal
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addProductForm, setAddProductForm] = useState({
    purchase_order_id: "",
    part_name: "",
    quantity: 1,
    unit_price: 0,
    warranty_months: 0,
  });

  // Inline vendor create
  const [showVendorCreate, setShowVendorCreate] = useState(false);
  const [vendorForm, setVendorForm] = useState({
    name: "",
    address: "",
    contact: "",
    gst_number: "",
    email: "",
  });

  // Invoice upload state
  const [createInvoiceFile, setCreateInvoiceFile] = useState(null); // File for create modal
  const [createInvoicePreview, setCreateInvoicePreview] = useState(null); // {name, size, type, isMultiImage}
  const [invoiceUploading, setInvoiceUploading] = useState(false);
  const createFileInputRef = useRef(null);
  const detailFileInputRef = useRef(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchOrders(),
      fetchExpenditure(),
      fetchServiceRecords(),
      fetchVendors(),
    ]);
    setLoading(false);
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await apiGet("/api/admin/purchase-orders");
      if (res.ok) setOrders(await res.json());
    } catch (e) {
      console.error(e);
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

  const fetchVendors = async () => {
    try {
      const res = await apiGet("/api/admin/vendors");
      if (res.ok) setVendors(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  // === Toggle Order Expand ===
  const toggleExpand = (orderId) => {
    setExpandedOrders((prev) => ({...prev, [orderId]: !prev[orderId]}));
  };

  // === Create Order ===
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const validProducts = bulkProducts.filter((p) => p.part_name.trim());
    if (validProducts.length === 0) {
      showToast("Add at least one product", "error");
      return;
    }
    try {
      const body = {
        service_record_id: parseInt(bulkForm.service_record_id),
        vendor_id: bulkForm.vendor_id ? parseInt(bulkForm.vendor_id) : null,
        invoice_number: bulkForm.invoice_number,
        purchased_date: bulkForm.purchased_date,
        status: bulkForm.status || "pending",
        notes: bulkForm.notes,
        parts: validProducts.map((p) => ({
          part_name: p.part_name,
          quantity: parseInt(p.quantity) || 1,
          unit_price: parseFloat(p.unit_price) || 0,
          warranty_months: parseInt(p.warranty_months) || 0,
        })),
      };
      const res = await apiPost("/api/admin/purchase-orders/create", body);
      const data = await res.json();
      if (res.ok) {
        // Upload invoice file if selected
        if (createInvoiceFile && data.order_id) {
          const formData = new FormData();
          formData.append("file", createInvoiceFile);
          try {
            const invRes = await apiUpload(
              `/api/admin/purchase-orders/${data.order_id}/invoice`,
              formData,
            );
            if (!invRes.ok) {
              const invData = await invRes.json();
              showToast(
                invData.error || "Order created but invoice upload failed",
                "warning",
              );
            }
          } catch {
            showToast("Order created but invoice upload failed", "warning");
          }
        }
        showToast(data.message || "Order created successfully", "success");
        closeCreateModal();
        fetchOrders();
        fetchExpenditure();
      } else {
        showToast(data.error || "Failed to create order", "error");
      }
    } catch {
      showToast("Failed to create order", "error");
    }
  };

  const addProductRow = () => {
    setBulkProducts([...bulkProducts, {...emptyProductRow}]);
  };

  const removeProductRow = (index) => {
    if (bulkProducts.length <= 1) return;
    setBulkProducts(bulkProducts.filter((_, i) => i !== index));
  };

  const updateProductRow = (index, field, value) => {
    const updated = [...bulkProducts];
    updated[index] = {...updated[index], [field]: value};
    setBulkProducts(updated);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setBulkForm({
      service_record_id: "",
      vendor_id: "",
      invoice_number: "",
      purchased_date: "",
      status: "pending",
      notes: "",
    });
    setBulkProducts([{...emptyProductRow}]);
    setShowVendorCreate(false);
    setCreateInvoiceFile(null);
    setCreateInvoicePreview(null);
  };

  // === Edit Order ===
  const openEditOrder = (order) => {
    setEditOrderForm({
      id: order.id,
      vendor_id: order.vendor_id || "",
      invoice_number: order.invoice_number || "",
      purchased_date: toInputDate(order.purchased_date),
      notes: order.notes || "",
    });
    setShowEditOrderModal(true);
  };

  const handleEditOrderSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = {
        id: editOrderForm.id,
        vendor_id: editOrderForm.vendor_id
          ? parseInt(editOrderForm.vendor_id)
          : null,
        invoice_number: editOrderForm.invoice_number,
        purchased_date: editOrderForm.purchased_date,
        notes: editOrderForm.notes,
      };
      const res = await apiPost("/api/admin/purchase-orders/update", body);
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Order updated", "success");
        setShowEditOrderModal(false);
        fetchOrders();
        refreshDetailModal(editOrderForm.id);
      } else {
        showToast(data.error || "Failed", "error");
      }
    } catch {
      showToast("Failed to update order", "error");
    }
  };

  // === Edit Product ===
  const openEditProduct = (product) => {
    setEditProductForm({
      id: product.id,
      part_name: product.part_name || "",
      quantity: product.quantity,
      unit_price: product.unit_price,
      warranty_months: product.warranty_months || 0,
      status: product.status || "pending",
      ordered_date: toInputDate(product.ordered_date),
      received_date: toInputDate(product.received_date),
      returned_date: toInputDate(product.returned_date),
      cancelled_date: toInputDate(product.cancelled_date),
    });
    setShowEditProductModal(true);
  };

  const handleEditProductSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = {
        id: editProductForm.id,
        part_name: editProductForm.part_name,
        quantity: parseInt(editProductForm.quantity) || 1,
        unit_price: parseFloat(editProductForm.unit_price) || 0,
        warranty_months: parseInt(editProductForm.warranty_months) || 0,
        status: editProductForm.status || "pending",
        ordered_date: editProductForm.ordered_date,
        received_date: editProductForm.received_date,
        returned_date: editProductForm.returned_date,
        cancelled_date: editProductForm.cancelled_date,
      };
      const res = await apiPost("/api/admin/services/parts/update", body);
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Product updated", "success");
        setShowEditProductModal(false);
        fetchOrders();
        fetchExpenditure();
        if (selectedOrder) refreshDetailModal(selectedOrder.id);
      } else {
        showToast(data.error || "Failed", "error");
      }
    } catch {
      showToast("Failed to update product", "error");
    }
  };

  // === Add Product to Order ===
  const openAddProduct = (order) => {
    setAddProductForm({
      purchase_order_id: order.id,
      part_name: "",
      quantity: 1,
      unit_price: 0,
      warranty_months: 0,
    });
    setShowAddProductModal(true);
  };

  const handleAddProductSubmit = async (e) => {
    e.preventDefault();
    if (!addProductForm.part_name.trim()) {
      showToast("Product name is required", "error");
      return;
    }
    try {
      const body = {
        purchase_order_id: addProductForm.purchase_order_id,
        part_name: addProductForm.part_name,
        quantity: parseInt(addProductForm.quantity) || 1,
        unit_price: parseFloat(addProductForm.unit_price) || 0,
        warranty_months: parseInt(addProductForm.warranty_months) || 0,
      };
      const res = await apiPost("/api/admin/purchase-orders/add-product", body);
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Product added", "success");
        setShowAddProductModal(false);
        fetchOrders();
        fetchExpenditure();
        if (selectedOrder) refreshDetailModal(addProductForm.purchase_order_id);
      } else {
        showToast(data.error || "Failed", "error");
      }
    } catch {
      showToast("Failed to add product", "error");
    }
  };

  // === Delete Order ===
  const handleDeleteOrder = async (orderId) => {
    const confirmed = await showConfirm(
      "Delete Order",
      "This will permanently delete this order and ALL its products. Are you sure?",
    );
    if (!confirmed) return;
    try {
      const res = await apiDelete(
        `/api/admin/purchase-orders/delete?id=${orderId}`,
      );
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        setShowDetailModal(false);
        setSelectedOrder(null);
        fetchOrders();
        fetchExpenditure();
      } else showToast(data.error || "Failed", "error");
    } catch {
      showToast("Failed to delete order", "error");
    }
  };

  // === Delete Product from Order ===
  const handleDeleteProduct = async (productId) => {
    const confirmed = await showConfirm(
      "Remove Product",
      "Remove this product from the order?",
    );
    if (!confirmed) return;
    try {
      const res = await apiDelete(
        `/api/admin/purchase-orders/remove-product?id=${productId}`,
      );
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        fetchOrders();
        fetchExpenditure();
        if (selectedOrder) refreshDetailModal(selectedOrder.id);
      } else showToast(data.error || "Failed", "error");
    } catch {
      showToast("Failed to remove product", "error");
    }
  };

  // === Order Status Change ===
  const handleOrderStatusChange = async (orderId, newStatus, cascade) => {
    const statusLabel =
      STATUS_OPTIONS.find((s) => s.value === newStatus)?.label || newStatus;
    const msg = cascade
      ? `Change order & all products to "${statusLabel}"?`
      : `Change order status to "${statusLabel}"? Individual product statuses won't change.`;
    const confirmed = await showConfirm("Update Order Status", msg);
    if (!confirmed) return;
    try {
      const res = await apiPost("/api/admin/purchase-orders/update-status", {
        id: orderId,
        status: newStatus,
        cascade: cascade,
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Status updated", "success");
        fetchOrders();
        fetchExpenditure();
        if (selectedOrder) refreshDetailModal(orderId);
      } else {
        showToast(data.error || "Failed", "error");
      }
    } catch {
      showToast("Failed to update status", "error");
    }
  };

  // === Product Status Change ===
  const handleProductStatusChange = async (partId, newStatus) => {
    const statusLabel =
      STATUS_OPTIONS.find((s) => s.value === newStatus)?.label || newStatus;
    const confirmed = await showConfirm(
      "Update Product Status",
      `Change product status to "${statusLabel}"?`,
    );
    if (!confirmed) return;
    try {
      const res = await apiPost("/api/admin/services/parts/update-status", {
        id: partId,
        status: newStatus,
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Status updated", "success");
        fetchOrders();
        if (selectedOrder) refreshDetailModal(selectedOrder.id);
      } else {
        showToast(data.error || "Failed", "error");
      }
    } catch {
      showToast("Failed to update status", "error");
    }
  };

  // === Vendor Create ===
  const handleVendorCreate = async () => {
    if (!vendorForm.name.trim()) {
      showToast("Vendor name is required", "error");
      return;
    }
    try {
      const res = await apiPost("/api/admin/vendors/create", vendorForm);
      const data = await res.json();
      if (res.ok) {
        showToast("Vendor created", "success");
        await fetchVendors();
        setBulkForm((prev) => ({...prev, vendor_id: String(data.id)}));
        setShowVendorCreate(false);
        setVendorForm({
          name: "",
          address: "",
          contact: "",
          gst_number: "",
          email: "",
        });
      } else {
        showToast(data.error || "Failed", "error");
      }
    } catch {
      showToast("Failed to create vendor", "error");
    }
  };

  // === Refresh detail modal ===
  const refreshDetailModal = async (orderId) => {
    try {
      const res = await apiGet(`/api/admin/purchase-orders/${orderId}`);
      if (res.ok) {
        const updated = await res.json();
        setSelectedOrder(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // === Invoice Helpers ===
  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Convert multiple images into a single PDF using jsPDF
  const imagesToPdf = async (files) => {
    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;

    for (let i = 0; i < files.length; i++) {
      if (i > 0) pdf.addPage();
      const file = files[i];
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });

      // Load image to get dimensions
      const img = await new Promise((resolve) => {
        const image = new window.Image();
        image.onload = () => resolve(image);
        image.src = dataUrl;
      });

      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;
      let w = img.width;
      let h = img.height;

      // Scale to fit page
      const ratio = Math.min(maxW / w, maxH / h, 1);
      w *= ratio;
      h *= ratio;

      // Center on page
      const x = (pageW - w) / 2;
      const y = (pageH - h) / 2;

      const format = file.type === "image/png" ? "PNG" : "JPEG";
      pdf.addImage(dataUrl, format, x, y, w, h);
    }

    const blob = pdf.output("blob");
    return new File([blob], "invoice_combined.pdf", {type: "application/pdf"});
  };

  // Handle file selection for invoice (both create and detail modals)
  const handleInvoiceFileSelect = async (e, context = "create") => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file types
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    const invalidFiles = files.filter((f) => !allowedTypes.includes(f.type));
    if (invalidFiles.length > 0) {
      showToast(
        "Only PDF and image files (JPEG, PNG, WebP) are allowed",
        "error",
      );
      return;
    }

    // Check total size (max 10MB per file)
    const oversized = files.filter((f) => f.size > 10 * 1024 * 1024);
    if (oversized.length > 0) {
      showToast("Each file must be under 10MB", "error");
      return;
    }

    const hasPdf = files.some((f) => f.type === "application/pdf");
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));

    let finalFile;
    let preview;

    if (hasPdf && files.length === 1) {
      // Single PDF
      finalFile = files[0];
      preview = {
        name: files[0].name,
        size: files[0].size,
        type: "pdf",
        isMultiImage: false,
      };
    } else if (imageFiles.length === 1 && files.length === 1) {
      // Single image — upload as-is
      finalFile = files[0];
      preview = {
        name: files[0].name,
        size: files[0].size,
        type: "image",
        isMultiImage: false,
      };
    } else if (imageFiles.length > 1) {
      // Multiple images — combine to PDF
      showToast(`Combining ${imageFiles.length} images into PDF...`, "info");
      try {
        finalFile = await imagesToPdf(imageFiles);
        preview = {
          name: `${imageFiles.length} images → invoice_combined.pdf`,
          size: finalFile.size,
          type: "pdf",
          isMultiImage: true,
          count: imageFiles.length,
        };
      } catch (err) {
        console.error(err);
        showToast("Failed to combine images into PDF", "error");
        return;
      }
    } else if (hasPdf && files.length > 1) {
      showToast("Please upload only one PDF file at a time", "error");
      return;
    } else {
      showToast("Invalid file selection", "error");
      return;
    }

    if (context === "create") {
      setCreateInvoiceFile(finalFile);
      setCreateInvoicePreview(preview);
    } else if (context === "detail") {
      // Upload immediately for existing order
      await uploadInvoiceForOrder(selectedOrder.id, finalFile);
    }

    // Reset the file input
    e.target.value = "";
  };

  // Upload invoice to server for an existing order
  const uploadInvoiceForOrder = async (orderId, file) => {
    setInvoiceUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiUpload(
        `/api/admin/purchase-orders/${orderId}/invoice`,
        formData,
      );
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Invoice uploaded", "success");
        fetchOrders();
        refreshDetailModal(orderId);
      } else {
        showToast(data.error || "Failed to upload invoice", "error");
      }
    } catch {
      showToast("Failed to upload invoice", "error");
    } finally {
      setInvoiceUploading(false);
    }
  };

  // Delete invoice for an order
  const handleDeleteInvoice = async (orderId) => {
    const confirmed = await showConfirm(
      "Delete Invoice",
      "This will permanently delete the uploaded invoice document. Continue?",
    );
    if (!confirmed) return;
    try {
      const res = await apiDelete(
        `/api/admin/purchase-orders/${orderId}/invoice`,
      );
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Invoice deleted", "success");
        fetchOrders();
        refreshDetailModal(orderId);
      } else {
        showToast(data.error || "Failed to delete invoice", "error");
      }
    } catch {
      showToast("Failed to delete invoice", "error");
    }
  };

  // === Computed ===
  const bulkGrandTotal = bulkProducts.reduce(
    (sum, p) =>
      sum + (parseInt(p.quantity) || 1) * (parseFloat(p.unit_price) || 0),
    0,
  );

  const filtered = orders.filter((o) => {
    if (vendorFilter && o.vendor_id !== parseInt(vendorFilter)) return false;
    if (statusFilter && o.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.invoice_number?.toLowerCase().includes(q) ||
      o.vendor_name?.toLowerCase().includes(q) ||
      o.vehicle_number?.toLowerCase().includes(q) ||
      o.vehicle_name?.toLowerCase().includes(q) ||
      o.products?.some((p) => p.part_name?.toLowerCase().includes(q))
    );
  });

  const statsCards = expenditure
    ? [
        {
          label: "Total Spent",
          value: `₹${(expenditure.total_spent || 0).toLocaleString()}`,
          icon: IndianRupee,
          color: "bg-purple-50 text-purple-600",
        },
        {
          label: "Total Orders",
          value: expenditure.total_orders || orders.length || 0,
          icon: ClipboardList,
          color: "bg-primary/10 text-primary",
        },
        {
          label: "Vehicles Served",
          value: expenditure.by_vehicle?.length || 0,
          icon: Truck,
          color: "bg-green-50 text-green-600",
        },
        {
          label: "Active Vendors",
          value: expenditure.active_vendors || 0,
          icon: Store,
          color: "bg-amber-50 text-amber-600",
        },
      ]
    : [];

  const tabs = [
    {key: "all", label: "All Orders"},
    {key: "by_vehicle", label: "By Vehicle"},
    {key: "by_vendor", label: "By Vendor"},
  ];

  if (loading && orders.length === 0) return <Loading fullScreen={false} />;

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Stats Cards */}
      {statsCards.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Tabs */}
      <div className="bg-secondarybg rounded-md border border-primarybg shadow-sm">
        <div className="flex border-b border-primarybg">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-3 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-secondarytext hover:text-primarytext hover:bg-primarybg"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === "by_vehicle" && (
            <div>
              {expenditure?.by_vehicle?.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {expenditure.by_vehicle.map((v) => (
                    <div
                      key={v.vehicle_id}
                      className="bg-primarybg rounded-md p-4 border border-primarybg hover:shadow-sm transition-shadow"
                    >
                      <p className="font-semibold text-primarytext text-sm">
                        {v.vehicle_number}
                      </p>
                      <p className="text-primary font-bold text-lg mt-1">
                        ₹{v.total_spent?.toLocaleString()}
                      </p>
                      <p className="text-xs text-secondarytext mt-0.5">
                        {v.parts_count} products purchased
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-secondarytext text-center py-8">
                  No expenditure data yet
                </p>
              )}
            </div>
          )}

          {activeTab === "by_vendor" && (
            <div>
              {expenditure?.by_vendor?.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {expenditure.by_vendor.map((v, i) => (
                    <div
                      key={i}
                      className="bg-primarybg rounded-md p-4 border border-primarybg hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Store size={14} className="text-secondarytext" />
                        <p className="font-semibold text-primarytext text-sm truncate">
                          {v.vendor_name}
                        </p>
                      </div>
                      <p className="text-primary font-bold text-lg mt-1">
                        ₹{v.total_spent?.toLocaleString()}
                      </p>
                      <p className="text-xs text-secondarytext mt-0.5">
                        {v.parts_count} products supplied
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-secondarytext text-center py-8">
                  No vendor expenditure data yet
                </p>
              )}
            </div>
          )}

          {activeTab === "all" && (
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
                  <CustomSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search invoice, vendor, vehicle..."
                  />
                  {vendors.length > 0 && (
                    <select
                      value={vendorFilter}
                      onChange={(e) => setVendorFilter(e.target.value)}
                      className="border border-gray-200 rounded-md px-3 py-2 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-primarytext"
                    >
                      <option value="">All Vendors</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="border border-gray-200 rounded-md px-3 py-2 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-primarytext"
                  >
                    <option value="">All Status</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-md hover:bg-primary/90 transition-all shadow-md hover:shadow-lg text-sm font-semibold whitespace-nowrap"
                >
                  <Plus size={18} strokeWidth={2.5} />
                  New Purchase
                </button>
              </div>

              {/* Orders Table */}
              <div className="overflow-x-auto rounded-md border border-primarybg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-primarybg border-b border-primarybg">
                      <th className="w-10 px-3 py-3"></th>
                      {[
                        "Invoice / Order",
                        "Vendor",
                        "Vehicle",
                        "Products",
                        "Total",
                        "Date",
                        "Status",
                      ].map((h, i) => (
                        <th
                          key={i}
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
                              <ClipboardList
                                size={32}
                                className="text-secondarytext"
                                strokeWidth={1.5}
                              />
                            </div>
                            <p className="text-secondarytext font-medium">
                              No purchase orders yet
                            </p>
                            <p className="text-secondarytext text-sm">
                              Click "New Purchase" to create an order
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filtered.map((order) => (
                        <React.Fragment key={order.id}>
                          {/* Order Row */}
                          <tr className="hover:bg-primarybg/50 transition-all group">
                            <td className="px-3 py-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpand(order.id);
                                }}
                                className="p-1 rounded hover:bg-primarybg transition-colors text-secondarytext"
                              >
                                {expandedOrders[order.id] ? (
                                  <ChevronDown size={16} />
                                ) : (
                                  <ChevronRight size={16} />
                                )}
                              </button>
                            </td>
                            <td
                              className="px-4 py-3 cursor-pointer"
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowDetailModal(true);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                  <FileText
                                    size={14}
                                    className="text-primary"
                                  />
                                </div>
                                <div>
                                  <span className="font-semibold text-primarytext block">
                                    {order.invoice_number || `#ORD-${order.id}`}
                                  </span>
                                  <span className="text-[10px] text-secondarytext flex items-center gap-1">
                                    {order.service_title || "Service Record"}
                                    {order.invoice_file && (
                                      <Paperclip
                                        size={10}
                                        className="text-primary"
                                        title="Invoice attached"
                                      />
                                    )}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td
                              className="px-4 py-3 cursor-pointer"
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowDetailModal(true);
                              }}
                            >
                              {order.vendor_name ? (
                                <span className="text-primarytext text-xs font-medium flex items-center gap-1">
                                  <Store
                                    size={12}
                                    className="text-secondarytext"
                                  />
                                  {order.vendor_name}
                                </span>
                              ) : (
                                <span className="text-secondarytext text-xs">
                                  -
                                </span>
                              )}
                            </td>
                            <td
                              className="px-4 py-3 cursor-pointer"
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowDetailModal(true);
                              }}
                            >
                              <span className="text-secondarytext text-xs">
                                {order.vehicle_name
                                  ? `${order.vehicle_name} (${order.vehicle_number})`
                                  : order.vehicle_number || "-"}
                              </span>
                            </td>
                            <td
                              className="px-4 py-3 cursor-pointer"
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowDetailModal(true);
                              }}
                            >
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                                <Package size={11} />
                                {order.product_count}
                              </span>
                            </td>
                            <td
                              className="px-4 py-3 cursor-pointer"
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowDetailModal(true);
                              }}
                            >
                              <span className="font-semibold text-primary">
                                ₹{order.total_amount?.toLocaleString()}
                              </span>
                            </td>
                            <td
                              className="px-4 py-3 cursor-pointer"
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowDetailModal(true);
                              }}
                            >
                              <span className="text-secondarytext text-xs">
                                {order.purchased_date || "-"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {getStatusBadge(order.status)}
                            </td>
                          </tr>

                          {/* Expanded Products */}
                          {expandedOrders[order.id] &&
                            order.products?.length > 0 && (
                              <>
                                {order.products.map((p) => (
                                  <tr
                                    key={`p-${p.id}`}
                                    className="bg-primarybg/30 border-l-2 border-l-primary/20"
                                  >
                                    <td className="px-3 py-2"></td>
                                    <td className="px-4 py-2 pl-10">
                                      <span className="text-primarytext text-xs flex items-center gap-1.5">
                                        <Package
                                          size={11}
                                          className="text-secondarytext"
                                        />
                                        {p.part_name}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-secondarytext text-xs">
                                      -
                                    </td>
                                    <td className="px-4 py-2 text-secondarytext text-xs">
                                      -
                                    </td>
                                    <td className="px-4 py-2 text-primarytext text-xs">
                                      {p.quantity} × ₹
                                      {p.unit_price?.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2 font-semibold text-primary text-xs">
                                      ₹{p.total_price?.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2 text-secondarytext text-xs">
                                      {p.warranty_months > 0
                                        ? `${p.warranty_months}mo warranty`
                                        : "-"}
                                    </td>
                                    <td className="px-4 py-2">
                                      {p.status !== order.status
                                        ? getStatusBadge(p.status)
                                        : null}
                                    </td>
                                  </tr>
                                ))}
                              </>
                            )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========== ORDER DETAIL MODAL ========== */}
      {showDetailModal && selectedOrder && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => {
            setShowDetailModal(false);
            setSelectedOrder(null);
          }}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center">
                  <FileText size={28} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-primarytext">
                    {selectedOrder.invoice_number ||
                      `Order #${selectedOrder.id}`}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusBadge(selectedOrder.status)}
                    <span className="text-sm text-secondarytext">
                      {selectedOrder.product_count} product
                      {selectedOrder.product_count !== 1 ? "s" : ""}
                    </span>
                    <span className="text-sm font-bold text-primary">
                      ₹{selectedOrder.total_amount?.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedOrder(null);
                }}
                className="text-secondarytext hover:text-primarytext transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Order Info Grid */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Vendor Info */}
              <div className="bg-primarybg rounded-md p-4">
                <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                  <Store size={14} /> Vendor Information
                </h4>
                {selectedOrder.vendor_name ? (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-secondarytext">Name</span>
                      <span className="font-semibold text-primarytext">
                        {selectedOrder.vendor_name}
                      </span>
                    </div>
                    {selectedOrder.vendor_contact && (
                      <div className="flex justify-between">
                        <span className="text-sm text-secondarytext">
                          Contact
                        </span>
                        <span className="font-medium text-primarytext">
                          {selectedOrder.vendor_contact}
                        </span>
                      </div>
                    )}
                    {selectedOrder.vendor_address && (
                      <div className="flex justify-between">
                        <span className="text-sm text-secondarytext">
                          Address
                        </span>
                        <span
                          className="font-medium text-primarytext text-right max-w-50"
                          title={selectedOrder.vendor_address}
                        >
                          {selectedOrder.vendor_address}
                        </span>
                      </div>
                    )}
                    {selectedOrder.vendor_gst && (
                      <div className="flex justify-between">
                        <span className="text-sm text-secondarytext">GST</span>
                        <span className="font-medium text-primarytext">
                          {selectedOrder.vendor_gst}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-secondarytext">
                    No vendor assigned
                  </p>
                )}
              </div>

              {/* Purchase Info */}
              <div className="bg-primarybg rounded-md p-4">
                <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                  <Calendar size={14} /> Purchase Info
                </h4>
                <div className="space-y-2">
                  {selectedOrder.invoice_number && (
                    <div className="flex justify-between">
                      <span className="text-sm text-secondarytext">
                        Invoice
                      </span>
                      <span className="font-semibold text-primarytext">
                        {selectedOrder.invoice_number}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-secondarytext">Date</span>
                    <span className="font-medium text-primarytext">
                      {selectedOrder.purchased_date || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-secondarytext">Vehicle</span>
                    <span className="font-medium text-primarytext">
                      {selectedOrder.vehicle_name ||
                        selectedOrder.vehicle_number ||
                        "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-secondarytext">Service</span>
                    <span
                      className="font-medium text-primarytext text-right max-w-50 truncate"
                      title={selectedOrder.service_title}
                    >
                      {selectedOrder.service_title || "-"}
                    </span>
                  </div>
                  {selectedOrder.added_by_name && (
                    <div className="flex justify-between">
                      <span className="text-sm text-secondarytext">
                        Added By
                      </span>
                      <span className="font-medium text-primarytext flex items-center gap-1">
                        <User size={12} className="text-secondarytext" />
                        {selectedOrder.added_by_name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            {selectedOrder.notes && (
              <div className="px-6 pb-2">
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                  <span className="font-semibold">Note:</span>{" "}
                  {selectedOrder.notes}
                </div>
              </div>
            )}

            {/* Invoice Document Section */}
            <div className="px-6 pb-2">
              <h4 className="text-xs font-bold text-secondarytext uppercase tracking-wider mb-3 flex items-center gap-2">
                <Paperclip size={14} /> Invoice Document
              </h4>
              {selectedOrder.invoice_file ? (
                <div className="bg-primarybg rounded-md border border-primarybg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-11 h-11 rounded-md flex items-center justify-center shrink-0 ${
                          selectedOrder.invoice_file.file_type === "pdf"
                            ? "bg-red-100 text-red-600"
                            : "bg-blue-100 text-blue-600"
                        }`}
                      >
                        {selectedOrder.invoice_file.file_type === "pdf" ? (
                          <File size={20} />
                        ) : (
                          <Image size={20} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm font-semibold text-primarytext truncate"
                          title={selectedOrder.invoice_file.original_name}
                        >
                          {selectedOrder.invoice_file.original_name}
                        </p>
                        <p className="text-xs text-secondarytext flex items-center gap-2">
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              selectedOrder.invoice_file.file_type === "pdf"
                                ? "bg-red-100 text-red-600"
                                : "bg-blue-100 text-blue-600"
                            }`}
                          >
                            {selectedOrder.invoice_file.file_type}
                          </span>
                          {formatFileSize(selectedOrder.invoice_file.file_size)}
                          <span className="text-gray-300">•</span>
                          {selectedOrder.invoice_file.created_at}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      <a
                        href={`${API_BASE}${selectedOrder.invoice_file.file_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-secondarytext hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                        title="View"
                      >
                        <Eye size={16} />
                      </a>
                      <a
                        href={`${API_BASE}${selectedOrder.invoice_file.file_url}`}
                        download={selectedOrder.invoice_file.original_name}
                        className="p-2 text-secondarytext hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                        title="Download"
                      >
                        <Download size={16} />
                      </a>
                      <button
                        onClick={() => {
                          if (detailFileInputRef.current)
                            detailFileInputRef.current.click();
                        }}
                        className="p-2 text-secondarytext hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                        title="Replace"
                      >
                        <Upload size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteInvoice(selectedOrder.id)}
                        className="p-2 text-secondarytext hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {/* Image thumbnail preview */}
                  {selectedOrder.invoice_file.file_type === "image" && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <img
                        src={`${API_BASE}${selectedOrder.invoice_file.file_url}`}
                        alt="Invoice preview"
                        className="max-h-40 rounded-md object-contain mx-auto"
                      />
                    </div>
                  )}
                  <input
                    type="file"
                    ref={detailFileInputRef}
                    onChange={(e) => handleInvoiceFileSelect(e, "detail")}
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                  />
                </div>
              ) : (
                <div
                  onClick={() => {
                    if (!invoiceUploading && detailFileInputRef.current)
                      detailFileInputRef.current.click();
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (invoiceUploading) return;
                    const fakeEvent = {
                      target: {files: e.dataTransfer.files, value: ""},
                    };
                    handleInvoiceFileSelect(fakeEvent, "detail");
                  }}
                  className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-all ${
                    invoiceUploading
                      ? "border-primary/40 bg-primary/5"
                      : "border-gray-300 hover:border-primary/50 hover:bg-primary/5"
                  }`}
                >
                  {invoiceUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2
                        size={28}
                        className="text-primary animate-spin"
                      />
                      <p className="text-sm font-medium text-primary">
                        Uploading...
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-primarybg flex items-center justify-center">
                        <Upload size={22} className="text-secondarytext" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-primarytext">
                          Drop invoice here or click to browse
                        </p>
                        <p className="text-xs text-secondarytext mt-0.5">
                          PDF or images (JPEG, PNG, WebP) • Max 10MB • Multiple
                          images auto-combined to PDF
                        </p>
                      </div>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={detailFileInputRef}
                    onChange={(e) => handleInvoiceFileSelect(e, "detail")}
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {/* Products Table */}
            <div className="px-6 pb-2">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-xs font-bold text-secondarytext uppercase tracking-wider flex items-center gap-2">
                  <ShoppingCart size={14} /> Products (
                  {selectedOrder.products?.length || 0})
                </h4>
                <button
                  onClick={() => openAddProduct(selectedOrder)}
                  className="flex items-center gap-1 text-primary text-xs font-semibold hover:text-primary/80 transition-colors"
                >
                  <Plus size={14} /> Add Product
                </button>
              </div>
              <div className="overflow-x-auto rounded-md border border-primarybg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-primarybg">
                      {[
                        "Product",
                        "Qty",
                        "Unit Price",
                        "Total",
                        "Warranty",
                        "Status",
                        "",
                      ].map((h, i) => (
                        <th
                          key={i}
                          className="text-left px-3 py-2 text-[10px] font-bold text-secondarytext uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primarybg">
                    {selectedOrder.products?.map((p) => (
                      <tr
                        key={p.id}
                        className="hover:bg-primarybg/50 transition"
                      >
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-primarytext">
                            {p.part_name}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-primarytext">
                          {p.quantity}
                        </td>
                        <td className="px-3 py-2.5 text-secondarytext">
                          ₹{p.unit_price?.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-primary">
                          ₹{p.total_price?.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-secondarytext text-xs">
                          {p.warranty_months > 0 ? (
                            <span className="flex items-center gap-1">
                              <Shield size={11} className="text-green-500" />
                              {p.warranty_months}mo
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            value={p.status}
                            onChange={(e) =>
                              handleProductStatusChange(p.id, e.target.value)
                            }
                            className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-primarybg focus:outline-none focus:ring-1 focus:ring-primary/30"
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditProduct(p)}
                              className="p-1 text-secondarytext hover:text-primary rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-1 text-secondarytext hover:text-red-500 rounded transition-colors"
                              title="Remove"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-primarybg/50 border-t border-primarybg">
                      <td
                        colSpan={3}
                        className="px-3 py-2.5 text-xs font-bold text-secondarytext uppercase"
                      >
                        Grand Total
                      </td>
                      <td className="px-3 py-2.5 font-extrabold text-primary text-base">
                        ₹{selectedOrder.total_amount?.toLocaleString()}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Status Timeline */}
            <div className="px-6 py-3">
              <div className="bg-primarybg rounded-md p-4">
                <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-4 font-bold flex items-center gap-2">
                  <ArrowRight size={14} /> Order Status
                </h4>
                <div className="flex items-center gap-0">
                  {STATUS_OPTIONS.map((opt, i) => {
                    const isActive = selectedOrder.status === opt.value;
                    const dateKey =
                      opt.value === "pending"
                        ? "ordered_date"
                        : `${opt.value}_date`;
                    const dateVal = selectedOrder[dateKey];
                    const Icon = opt.icon;
                    return (
                      <React.Fragment key={opt.value}>
                        {i > 0 && (
                          <div className="flex-1 h-px bg-gray-200 mx-1" />
                        )}
                        <div className="flex flex-col items-center gap-1.5 min-w-17.5">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                              isActive
                                ? `${opt.color} border shadow-sm`
                                : dateVal
                                  ? "bg-gray-100 text-gray-500 border border-gray-200"
                                  : "bg-gray-50 text-gray-300 border border-gray-100"
                            }`}
                          >
                            <Icon size={16} />
                          </div>
                          <span
                            className={`text-[10px] font-semibold ${isActive ? "text-primarytext" : "text-secondarytext"}`}
                          >
                            {opt.label}
                          </span>
                          {dateVal ? (
                            <span className="text-[10px] text-secondarytext">
                              {dateVal}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-300">-</span>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Status Change Buttons */}
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider mb-2">
                    Change Order Status (applies to all products)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.filter(
                      (s) => s.value !== selectedOrder.status,
                    ).map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          onClick={() =>
                            handleOrderStatusChange(
                              selectedOrder.id,
                              opt.value,
                              true,
                            )
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all hover:shadow-sm ${opt.color}`}
                        >
                          <Icon size={13} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-gray-100 flex justify-between items-center">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedOrder(null);
                }}
                className="px-4 py-2 text-secondarytext hover:bg-gray-100 rounded-md transition-colors text-sm font-medium"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDeleteOrder(selectedOrder.id)}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Trash2 size={16} /> Delete Order
                </button>
                <button
                  onClick={() => {
                    openEditOrder(selectedOrder);
                  }}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2 text-sm font-semibold"
                >
                  <Edit2 size={16} /> Edit Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== CREATE ORDER MODAL ========== */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={closeCreateModal}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-primarybg flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-primarytext">
                  New Purchase Order
                </h3>
                <p className="text-xs text-secondarytext mt-0.5">
                  Create a bill with multiple products from the same vendor
                </p>
              </div>
              <button
                onClick={closeCreateModal}
                className="text-secondarytext hover:text-primarytext transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-5">
              {/* Order Details */}
              <div className="bg-primarybg rounded-md p-4 space-y-4">
                <h4 className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                  Order Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                      Service Record *
                    </label>
                    <SearchableSelect
                      value={bulkForm.service_record_id}
                      onChange={(val) =>
                        setBulkForm({...bulkForm, service_record_id: val})
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
                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                      Vendor
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <SearchableSelect
                          value={bulkForm.vendor_id}
                          onChange={(val) =>
                            setBulkForm({...bulkForm, vendor_id: val})
                          }
                          placeholder="Select Vendor"
                          options={vendors.map((v) => ({
                            value: v.id,
                            label: v.name,
                            subtitle: v.address
                              ? v.address.substring(0, 50)
                              : v.contact || "",
                          }))}
                          emptyMessage="No vendors found"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowVendorCreate(!showVendorCreate)}
                        className="px-3 py-2 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors text-xs font-semibold whitespace-nowrap"
                        title="Add new vendor"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Inline Vendor Create */}
                {showVendorCreate && (
                  <div className="border border-primary/20 bg-primary/5 rounded-md p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <h5 className="text-xs font-bold text-primary uppercase tracking-wider">
                        Quick Add Vendor
                      </h5>
                      <button
                        type="button"
                        onClick={() => setShowVendorCreate(false)}
                        className="text-secondarytext hover:text-primarytext"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={vendorForm.name}
                        onChange={(e) =>
                          setVendorForm({
                            ...vendorForm,
                            name: e.target.value,
                          })
                        }
                        className="w-full border border-gray-200 rounded-md p-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Vendor name *"
                      />
                      <input
                        type="text"
                        value={vendorForm.contact}
                        onChange={(e) =>
                          setVendorForm({
                            ...vendorForm,
                            contact: e.target.value,
                          })
                        }
                        className="w-full border border-gray-200 rounded-md p-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Contact"
                      />
                    </div>
                    <textarea
                      value={vendorForm.address}
                      onChange={(e) =>
                        setVendorForm({
                          ...vendorForm,
                          address: e.target.value,
                        })
                      }
                      className="w-full border border-gray-200 rounded-md p-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Address"
                      rows={2}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={vendorForm.gst_number}
                        onChange={(e) =>
                          setVendorForm({
                            ...vendorForm,
                            gst_number: e.target.value,
                          })
                        }
                        className="w-full border border-gray-200 rounded-md p-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="GST Number"
                      />
                      <input
                        type="email"
                        value={vendorForm.email}
                        onChange={(e) =>
                          setVendorForm({
                            ...vendorForm,
                            email: e.target.value,
                          })
                        }
                        className="w-full border border-gray-200 rounded-md p-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Email"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleVendorCreate}
                      className="bg-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-primary/90 transition-all"
                    >
                      Create & Select Vendor
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                      Invoice Number
                    </label>
                    <input
                      type="text"
                      value={bulkForm.invoice_number}
                      onChange={(e) =>
                        setBulkForm({
                          ...bulkForm,
                          invoice_number: e.target.value,
                        })
                      }
                      className="w-full border border-gray-200 rounded-md p-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="INV-XXX"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                      Purchase Date
                    </label>
                    <input
                      type="date"
                      value={bulkForm.purchased_date}
                      onChange={(e) =>
                        setBulkForm({
                          ...bulkForm,
                          purchased_date: e.target.value,
                        })
                      }
                      className="w-full border border-gray-200 rounded-md p-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Notes
                  </label>
                  <textarea
                    value={bulkForm.notes}
                    onChange={(e) =>
                      setBulkForm({...bulkForm, notes: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Optional notes for this order..."
                    rows={2}
                  />
                </div>

                {/* Invoice Upload (Optional) */}
                <div>
                  <label className="text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Paperclip size={12} /> Invoice Document (Optional)
                  </label>
                  {createInvoicePreview ? (
                    <div className="border border-gray-200 rounded-md p-3 bg-white flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${
                            createInvoicePreview.type === "pdf"
                              ? "bg-red-100 text-red-600"
                              : "bg-blue-100 text-blue-600"
                          }`}
                        >
                          {createInvoicePreview.type === "pdf" ? (
                            <File size={16} />
                          ) : (
                            <Image size={16} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-primarytext truncate">
                            {createInvoicePreview.name}
                          </p>
                          <p className="text-xs text-secondarytext flex items-center gap-1.5">
                            <span
                              className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                createInvoicePreview.type === "pdf"
                                  ? "bg-red-100 text-red-600"
                                  : "bg-blue-100 text-blue-600"
                              }`}
                            >
                              {createInvoicePreview.type}
                            </span>
                            {formatFileSize(createInvoicePreview.size)}
                            {createInvoicePreview.isMultiImage && (
                              <span className="text-primary font-medium">
                                ({createInvoicePreview.count} images combined)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCreateInvoiceFile(null);
                          setCreateInvoicePreview(null);
                        }}
                        className="p-1.5 text-secondarytext hover:text-red-500 hover:bg-red-50 rounded-md transition-colors shrink-0 ml-2"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        if (createFileInputRef.current)
                          createFileInputRef.current.click();
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const fakeEvent = {
                          target: {files: e.dataTransfer.files, value: ""},
                        };
                        handleInvoiceFileSelect(fakeEvent, "create");
                      }}
                      className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                    >
                      <div className="flex flex-col items-center gap-1.5">
                        <Upload size={20} className="text-secondarytext" />
                        <p className="text-xs font-medium text-secondarytext">
                          Drop PDF or images here, or click to browse
                        </p>
                        <p className="text-[10px] text-secondarytext">
                          Multiple images will be auto-combined into a single
                          PDF
                        </p>
                      </div>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={createFileInputRef}
                    onChange={(e) => handleInvoiceFileSelect(e, "create")}
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                  />
                </div>
              </div>

              {/* Products Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Products ({bulkProducts.length})
                  </h4>
                  <button
                    type="button"
                    onClick={addProductRow}
                    className="flex items-center gap-1.5 text-primary text-sm font-semibold hover:text-primary/80 transition-colors"
                  >
                    <Plus size={16} />
                    Add Product
                  </button>
                </div>

                <div className="space-y-3">
                  {bulkProducts.map((product, index) => (
                    <div
                      key={index}
                      className="bg-primarybg rounded-md p-4 border border-primarybg relative"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-secondarytext flex items-center gap-1.5">
                          <Hash size={12} />
                          Product {index + 1}
                        </span>
                        {bulkProducts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeProductRow(index)}
                            className="text-red-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-[10px] font-bold text-secondarytext uppercase mb-1">
                            Product Name *
                          </label>
                          <input
                            type="text"
                            value={product.part_name}
                            onChange={(e) =>
                              updateProductRow(
                                index,
                                "part_name",
                                e.target.value,
                              )
                            }
                            className="w-full border border-gray-200 rounded-md p-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            placeholder="Product name"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-secondarytext uppercase mb-1">
                            Quantity
                          </label>
                          <input
                            type="number"
                            value={product.quantity}
                            onChange={(e) =>
                              updateProductRow(
                                index,
                                "quantity",
                                e.target.value,
                              )
                            }
                            className="w-full border border-gray-200 rounded-md p-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            min="1"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-secondarytext uppercase mb-1">
                            Unit Price (₹)
                          </label>
                          <input
                            type="number"
                            value={product.unit_price}
                            onChange={(e) =>
                              updateProductRow(
                                index,
                                "unit_price",
                                e.target.value,
                              )
                            }
                            className="w-full border border-gray-200 rounded-md p-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            step="0.01"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-secondarytext uppercase mb-1">
                            Warranty (Mo)
                          </label>
                          <input
                            type="number"
                            value={product.warranty_months}
                            onChange={(e) =>
                              updateProductRow(
                                index,
                                "warranty_months",
                                e.target.value,
                              )
                            }
                            className="w-full border border-gray-200 rounded-md p-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            min="0"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end mt-2">
                        <span className="text-xs text-secondarytext">
                          Subtotal:{" "}
                          <span className="font-bold text-primary">
                            ₹
                            {(
                              (parseInt(product.quantity) || 1) *
                              (parseFloat(product.unit_price) || 0)
                            ).toLocaleString()}
                          </span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between bg-primarybg rounded-md p-4 border border-primarybg">
                <div>
                  <span className="text-sm text-secondarytext font-medium">
                    {bulkProducts.filter((p) => p.part_name.trim()).length}{" "}
                    items
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-secondarytext uppercase font-bold mr-2">
                    Grand Total:
                  </span>
                  <span className="text-xl font-extrabold text-primary">
                    ₹{bulkGrandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-white rounded-md py-3 font-semibold hover:bg-primary/90 transition-all shadow-md hover:shadow-lg text-sm"
              >
                Create Order with{" "}
                {bulkProducts.filter((p) => p.part_name.trim()).length} Product
                {bulkProducts.filter((p) => p.part_name.trim()).length !== 1
                  ? "s"
                  : ""}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========== EDIT ORDER MODAL ========== */}
      {showEditOrderModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setShowEditOrderModal(false)}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl max-w-lg w-full animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-primarybg flex justify-between items-center">
              <h3 className="text-lg font-bold text-primarytext">Edit Order</h3>
              <button
                onClick={() => setShowEditOrderModal(false)}
                className="text-secondarytext hover:text-primarytext transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditOrderSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Vendor
                </label>
                <SearchableSelect
                  value={editOrderForm.vendor_id}
                  onChange={(val) =>
                    setEditOrderForm({...editOrderForm, vendor_id: val})
                  }
                  placeholder="Select Vendor"
                  options={vendors.map((v) => ({
                    value: v.id,
                    label: v.name,
                    subtitle: v.address
                      ? v.address.substring(0, 50)
                      : v.contact || "",
                  }))}
                  emptyMessage="No vendors"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    value={editOrderForm.invoice_number}
                    onChange={(e) =>
                      setEditOrderForm({
                        ...editOrderForm,
                        invoice_number: e.target.value,
                      })
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
                    value={editOrderForm.purchased_date}
                    onChange={(e) =>
                      setEditOrderForm({
                        ...editOrderForm,
                        purchased_date: e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Notes
                </label>
                <textarea
                  value={editOrderForm.notes}
                  onChange={(e) =>
                    setEditOrderForm({
                      ...editOrderForm,
                      notes: e.target.value,
                    })
                  }
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Optional notes..."
                  rows={2}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-primary text-white rounded-md py-2.5 font-semibold hover:bg-primary/90 transition-all shadow-md hover:shadow-lg"
              >
                Update Order
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========== EDIT PRODUCT MODAL ========== */}
      {showEditProductModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setShowEditProductModal(false)}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl max-w-lg w-full animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-primarybg flex justify-between items-center">
              <h3 className="text-lg font-bold text-primarytext">
                Edit Product
              </h3>
              <button
                onClick={() => setShowEditProductModal(false)}
                className="text-secondarytext hover:text-primarytext transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditProductSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={editProductForm.part_name}
                  onChange={(e) =>
                    setEditProductForm({
                      ...editProductForm,
                      part_name: e.target.value,
                    })
                  }
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={editProductForm.quantity}
                    onChange={(e) =>
                      setEditProductForm({
                        ...editProductForm,
                        quantity: e.target.value,
                      })
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
                    value={editProductForm.unit_price}
                    onChange={(e) =>
                      setEditProductForm({
                        ...editProductForm,
                        unit_price: e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Total
                  </label>
                  <div className="h-10.5 px-3 bg-primary/5 border border-primary/20 rounded-md flex items-center">
                    <span className="text-sm font-bold text-primary">
                      ₹
                      {(
                        (parseInt(editProductForm.quantity) || 1) *
                        (parseFloat(editProductForm.unit_price) || 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Warranty (Months)
                  </label>
                  <input
                    type="number"
                    value={editProductForm.warranty_months}
                    onChange={(e) =>
                      setEditProductForm({
                        ...editProductForm,
                        warranty_months: e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <select
                    value={editProductForm.status}
                    onChange={(e) =>
                      setEditProductForm({
                        ...editProductForm,
                        status: e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-primary text-white rounded-md py-2.5 font-semibold hover:bg-primary/90 transition-all shadow-md hover:shadow-lg"
              >
                Update Product
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========== ADD PRODUCT TO ORDER MODAL ========== */}
      {showAddProductModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setShowAddProductModal(false)}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl max-w-lg w-full animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-primarybg flex justify-between items-center">
              <h3 className="text-lg font-bold text-primarytext">
                Add Product to Order
              </h3>
              <button
                onClick={() => setShowAddProductModal(false)}
                className="text-secondarytext hover:text-primarytext transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddProductSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={addProductForm.part_name}
                  onChange={(e) =>
                    setAddProductForm({
                      ...addProductForm,
                      part_name: e.target.value,
                    })
                  }
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Enter product name"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={addProductForm.quantity}
                    onChange={(e) =>
                      setAddProductForm({
                        ...addProductForm,
                        quantity: e.target.value,
                      })
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
                    value={addProductForm.unit_price}
                    onChange={(e) =>
                      setAddProductForm({
                        ...addProductForm,
                        unit_price: e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Warranty (Mo)
                  </label>
                  <input
                    type="number"
                    value={addProductForm.warranty_months}
                    onChange={(e) =>
                      setAddProductForm({
                        ...addProductForm,
                        warranty_months: e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    min="0"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <span className="text-sm text-secondarytext">
                  Total:{" "}
                  <span className="font-bold text-primary text-base">
                    ₹
                    {(
                      (parseInt(addProductForm.quantity) || 1) *
                      (parseFloat(addProductForm.unit_price) || 0)
                    ).toLocaleString()}
                  </span>
                </span>
              </div>
              <button
                type="submit"
                className="w-full bg-primary text-white rounded-md py-2.5 font-semibold hover:bg-primary/90 transition-all shadow-md hover:shadow-lg"
              >
                Add Product
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
