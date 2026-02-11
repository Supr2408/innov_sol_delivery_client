
import { createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Download,
  Loader2,
  PackagePlus,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import LiveRouteMap from "../../components/LiveRouteMap";
import { AppContext } from "../../context/appContext";

const ORDER_STATUS_LABELS = {
  pending: "Incoming",
  confirmed: "Preparing",
  shipped: "Ready",
  in_transit: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const OVERDUE_MINUTES = 20;
const MAPTILER_API_KEY = import.meta.env.VITE_MAPTILER_API_KEY;
const INVENTORY_TEMPLATE_ROWS = [
  ["Item Name", "Description", "Price", "Stock", "Category", "SKU", "Image"],
  ["Fresh Bread", "Daily baked bread", "4.50", "24", "Bakery", "BRD-001", ""],
  ["Milk 1L", "Low fat milk", "2.99", "30", "Dairy", "MLK-001", ""],
];

const MotionHeader = motion.header;
const MotionSection = motion.section;
const MotionArticle = motion.article;
const MotionAside = motion.aside;
const MotionDiv = motion.div;

const loadSocketClient = () =>
  new Promise((resolve, reject) => {
    if (window.io) {
      resolve(window.io);
      return;
    }

    const existingScript = document.querySelector("script[data-socket-io-client]");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.io));
      existingScript.addEventListener("error", () =>
        reject(new Error("Socket client failed to load")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.socket.io/4.8.1/socket.io.min.js";
    script.async = true;
    script.dataset.socketIoClient = "true";
    script.addEventListener("load", () => resolve(window.io));
    script.addEventListener("error", () => reject(new Error("Socket client failed to load")));
    document.body.appendChild(script);
  });

const resolveSocketServerUrl = () => {
  const configuredBackendUrl = import.meta.env.VITE_BACKEND_URL;
  if (!configuredBackendUrl) return "http://localhost:5000";

  try {
    const parsedBackendUrl = new URL(configuredBackendUrl);
    return `${parsedBackendUrl.protocol}//${parsedBackendUrl.host}`;
  } catch {
    return configuredBackendUrl.replace(/\/api\/?$/, "");
  }
};

const toLocation = (location) => {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
};

const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;

const createGeneratedSku = (itemName = "") => {
  const slug = String(itemName || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 16);

  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${slug || "ITEM"}-${suffix}`;
};

const isSameDate = (dateA, dateB) =>
  dateA.getFullYear() === dateB.getFullYear() &&
  dateA.getMonth() === dateB.getMonth() &&
  dateA.getDate() === dateB.getDate();

const minutesFromNow = (dateValue) => {
  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
};

const resolveOrderPartner = (order) => {
  const partnerObject = typeof order?.partnerId === "object" ? order.partnerId : null;
  const partnerId = partnerObject?._id || order?.partnerId || "";

  return {
    partnerId: String(partnerId || ""),
    name: partnerObject?.name || order?.partnerName || "Unassigned",
    vehicle: partnerObject?.vehicle || order?.partnerVehicle || "-",
  };
};

const resolvePickupDestination = (order, storeLocation) => {
  return (
    toLocation(order?.pickupLocation) ||
    toLocation(order?.storeLocation) ||
    toLocation(order?.storeId?.location) ||
    storeLocation ||
    null
  );
};

const resolveMapDestination = (order, storeLocation) => {
  const pickupDestination = resolvePickupDestination(order, storeLocation);

  if (order?.status === "shipped") {
    return pickupDestination;
  }

  return toLocation(order?.customerLocation) || pickupDestination;
};

const isOrderOverdue = (order) => {
  if (!["pending", "confirmed"].includes(order?.status)) return false;
  return minutesFromNow(order?.createdAt) >= OVERDUE_MINUTES;
};

const getStatusBadge = (order) => {
  if (isOrderOverdue(order)) {
    return {
      label: "Overdue",
      className: "bg-rose-100 text-rose-700 ring-1 ring-rose-200 animate-pulse",
    };
  }

  switch (order?.status) {
    case "pending":
      return {
        label: "Incoming",
        className: "bg-red-100 text-red-700 ring-1 ring-red-200",
      };
    case "confirmed":
      return {
        label: "Preparing",
        className: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
      };
    case "shipped":
      return {
        label: "Ready",
        className: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
      };
    case "in_transit":
      return {
        label: "Dispatched",
        className: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
      };
    case "delivered":
      return {
        label: "Delivered",
        className: "bg-green-100 text-green-700 ring-1 ring-green-200",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-slate-200 text-slate-700 ring-1 ring-slate-300",
      };
    default:
      return {
        label: ORDER_STATUS_LABELS[order?.status] || "Unknown",
        className: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
      };
  }
};

const sortByNewest = (items) =>
  [...items].sort(
    (firstOrder, secondOrder) =>
      new Date(secondOrder?.createdAt || 0).getTime() - new Date(firstOrder?.createdAt || 0).getTime(),
  );

const MetricCard = ({ icon: Icon, label, value, hint }) => (
  <MotionArticle
    layout
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.18 }}
    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
  >
    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
      {createElement(Icon, { size: 18 })}
    </div>
    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    <p className="mt-1 text-xs text-slate-500">{hint}</p>
  </MotionArticle>
);

const ColumnShell = ({ title, subtitle, count, children }) => (
  <MotionSection
    layout
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2 }}
    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
  >
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{count}</span>
    </div>
    <div className="space-y-3">{children}</div>
  </MotionSection>
);

const StoreDashboard = () => {
  const { user, token, userRole } = useContext(AppContext);
  const storeId = user?.id || user?._id;

  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [partners, setPartners] = useState([]);

  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingPartners, setLoadingPartners] = useState(false);

  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [updatingItemId, setUpdatingItemId] = useState("");
  const [selectedPartnerByOrder, setSelectedPartnerByOrder] = useState({});
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryCategory, setInventoryCategory] = useState("All");
  const [importingItems, setImportingItems] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [newItemForm, setNewItemForm] = useState({
    itemName: "",
    description: "",
    price: "",
    stock: "",
    category: "General",
    sku: "",
    image: "",
  });

  const [socketConnected, setSocketConnected] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [storeLocation, setStoreLocation] = useState(null);

  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const knownPositiveStockRef = useRef({});
  const excelInputRef = useRef(null);

  const upsertOrder = useCallback((orderList, nextOrder) => {
    const withoutCurrent = orderList.filter((order) => String(order._id) !== String(nextOrder._id));
    return [nextOrder, ...withoutCurrent];
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!storeId) return;

    try {
      setLoadingOrders(true);
      const { data } = await axios.get(`/orders/${storeId}`);
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
    } catch {
      toast.error("Failed to fetch orders");
    } finally {
      setLoadingOrders(false);
    }
  }, [storeId]);

  const fetchItems = useCallback(async () => {
    if (!storeId) return;

    try {
      setLoadingItems(true);
      const { data } = await axios.get(`/items/${storeId}`);
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      toast.error("Failed to fetch inventory");
    } finally {
      setLoadingItems(false);
    }
  }, [storeId]);

  const fetchPartners = useCallback(async () => {
    try {
      setLoadingPartners(true);
      const { data } = await axios.get("/partners/all");
      setPartners(Array.isArray(data?.partners) ? data.partners : []);
    } catch {
      toast.error("Failed to fetch partners");
    } finally {
      setLoadingPartners(false);
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    await Promise.all([fetchOrders(), fetchItems(), fetchPartners()]);
  }, [fetchItems, fetchOrders, fetchPartners]);

  const playNewOrderSound = useCallback(async () => {
    if (typeof window === "undefined") return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      const audioContext =
        audioContextRef.current && audioContextRef.current.state !== "closed"
          ? audioContextRef.current
          : new AudioContextClass();

      audioContextRef.current = audioContext;

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(920, now);
      oscillator.frequency.exponentialRampToValueAtTime(700, now + 0.25);

      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.linearRampToValueAtTime(0.05, now + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(now);
      oscillator.stop(now + 0.3);
    } catch {
      // Audio cue is best-effort only.
    }
  }, []);

  const notifyBrowser = useCallback((order) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const orderCode = order?.orderId || "New order";
    const amount = Number(order?.totalAmount || 0).toFixed(2);

    try {
      const notification = new Notification("New Incoming Order", {
        body: `${orderCode} - $${amount}`,
      });
      setTimeout(() => notification.close(), 6000);
    } catch {
      // Notification permission may be blocked by browser policy.
    }
  }, []);

  useEffect(() => {
    if (!storeId) return;
    refreshDashboard();
  }, [refreshDashboard, storeId]);

  useEffect(() => {
    items.forEach((item) => {
      const stock = Number(item?.stock || 0);
      if (stock > 0) {
        knownPositiveStockRef.current[String(item._id)] = stock;
      }
    });
  }, [items]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {
        // Permission requests can fail silently in some browsers.
      });
    }
  }, []);

  useEffect(() => {
    const inlineCoordinates = toLocation(user?.location) || toLocation(user?.coordinates);
    if (inlineCoordinates) {
      setStoreLocation(inlineCoordinates);
      return;
    }

    const addressQuery = [user?.address, user?.city].filter(Boolean).join(", ").trim();
    if (!addressQuery || !MAPTILER_API_KEY) {
      setStoreLocation(null);
      return;
    }

    const controller = new AbortController();

    const resolveAddressCoordinates = async () => {
      try {
        const encodedQuery = encodeURIComponent(addressQuery);
        const response = await fetch(
          `https://api.maptiler.com/geocoding/${encodedQuery}.json?key=${MAPTILER_API_KEY}&limit=1`,
          { signal: controller.signal },
        );

        if (!response.ok) return;

        const data = await response.json();
        const center = data?.features?.[0]?.center;
        if (!Array.isArray(center) || center.length < 2) return;

        setStoreLocation({ lat: Number(center[1]), lng: Number(center[0]) });
      } catch {
        // If geocoding fails, route tracking cards will show fallback message.
      }
    };

    resolveAddressCoordinates();

    return () => controller.abort();
  }, [user?.address, user?.city, user?.coordinates, user?.location]);

  useEffect(() => {
    if (!token || !storeId) return;

    let activeSocket;

    const bindSocket = async () => {
      try {
        const ioClient = await loadSocketClient();
        if (typeof ioClient !== "function") return;

        activeSocket = ioClient(resolveSocketServerUrl(), {
          transports: ["websocket"],
          auth: { token },
        });

        socketRef.current = activeSocket;

        const handleIncomingOrderPayload = (payload = {}) => {
          const incomingOrder = payload?.order?._id ? payload.order : payload;
          if (!incomingOrder?._id) return;

          setOrders((currentOrders) => upsertOrder(currentOrders, incomingOrder));
          playNewOrderSound();
          notifyBrowser(incomingOrder);
          toast.info(payload?.title || `New order ${incomingOrder.orderId || "received"}`);
        };

        activeSocket.on("connect", () => {
          setSocketConnected(true);
          activeSocket.emit("join:store", storeId);
        });

        activeSocket.on("disconnect", () => {
          setSocketConnected(false);
        });

        activeSocket.on("order:store:new", handleIncomingOrderPayload);
        activeSocket.on("order:new", handleIncomingOrderPayload);

        activeSocket.on("order:store:updated", ({ order }) => {
          if (!order?._id) return;
          setOrders((currentOrders) => upsertOrder(currentOrders, order));
        });

        activeSocket.on("order:store:partner-location", ({ orderId, partnerCurrentLocation }) => {
          if (!orderId || !partnerCurrentLocation) return;

          setOrders((currentOrders) =>
            currentOrders.map((order) =>
              String(order._id) === String(orderId)
                ? {
                    ...order,
                    partnerCurrentLocation,
                  }
                : order,
            ),
          );
        });
      } catch {
        toast.error("Unable to initialize realtime updates");
      }
    };

    bindSocket();

    return () => {
      if (activeSocket) {
        activeSocket.disconnect();
      }
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [notifyBrowser, playNewOrderSound, storeId, token, upsertOrder]);

  useEffect(
    () => () => {
      if (audioContextRef.current?.state !== "closed") {
        audioContextRef.current?.close();
      }
      audioContextRef.current = null;
    },
    [],
  );

  const updateOrderStatus = useCallback(
    async (orderId, status, extraPayload = {}) => {
      try {
        setUpdatingOrderId(orderId);
        const { data } = await axios.put(`/orders/${orderId}`, {
          status,
          ...extraPayload,
        });

        if (data?.order?._id) {
          setOrders((currentOrders) => upsertOrder(currentOrders, data.order));
        } else {
          await fetchOrders();
        }

        toast.success(`Order moved to ${ORDER_STATUS_LABELS[status] || status}`);
      } catch (error) {
        toast.error(error?.response?.data?.message || "Failed to update order status");
      } finally {
        setUpdatingOrderId("");
      }
    },
    [fetchOrders, upsertOrder],
  );

  const handleAcceptOrder = useCallback(
    async (orderId) => {
      await updateOrderStatus(orderId, "confirmed");
    },
    [updateOrderStatus],
  );

  const handleDeclineOrder = useCallback(
    async (orderId) => {
      await updateOrderStatus(orderId, "cancelled");
    },
    [updateOrderStatus],
  );

  const handleMarkReady = useCallback(
    async (order) => {
      const selectedPartnerId =
        selectedPartnerByOrder[order._id] || resolveOrderPartner(order).partnerId;

      if (!selectedPartnerId) {
        toast.error("Select a partner before marking this order as ready");
        return;
      }

      await updateOrderStatus(order._id, "shipped", {
        partnerId: selectedPartnerId,
      });
    },
    [selectedPartnerByOrder, updateOrderStatus],
  );

  const handleToggleItemStock = useCallback(async (item) => {
    const itemId = String(item._id);
    const currentStock = Number(item?.stock || 0);
    const isInStock = currentStock > 0;

    if (isInStock) {
      knownPositiveStockRef.current[itemId] = currentStock;
    }

    const restoredStock = Math.max(1, Number(knownPositiveStockRef.current[itemId] || 1));
    const nextStock = isInStock ? 0 : restoredStock;

    try {
      setUpdatingItemId(itemId);

      await axios.put(`/items/${itemId}`, {
        itemName: item.itemName,
        description: item.description || "",
        price: Number(item.price || 0),
        stock: nextStock,
        category: item.category || "General",
        sku: item.sku || `SKU-${itemId}`,
        image: item.image || "",
        specifications: Array.isArray(item.specifications) ? item.specifications : [],
      });

      setItems((currentItems) =>
        currentItems.map((currentItem) =>
          String(currentItem._id) === itemId
            ? {
                ...currentItem,
                stock: nextStock,
              }
            : currentItem,
        ),
      );

      toast.success(`${item.itemName} is now ${nextStock > 0 ? "In Stock" : "Out of Stock"}`);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update item stock");
    } finally {
      setUpdatingItemId("");
    }
  }, []);

  const handleAdjustItemStock = useCallback(async (item, delta) => {
    const itemId = String(item._id);
    const nextStock = Math.max(0, Number(item.stock || 0) + Number(delta || 0));

    try {
      setUpdatingItemId(itemId);

      await axios.put(`/items/${itemId}`, {
        itemName: item.itemName,
        description: item.description || "",
        price: Number(item.price || 0),
        stock: nextStock,
        category: item.category || "General",
        sku: item.sku || createGeneratedSku(item.itemName),
        image: item.image || "",
        specifications: Array.isArray(item.specifications) ? item.specifications : [],
      });

      setItems((currentItems) =>
        currentItems.map((currentItem) =>
          String(currentItem._id) === itemId
            ? {
                ...currentItem,
                stock: nextStock,
              }
            : currentItem,
        ),
      );

      if (nextStock > 0) {
        knownPositiveStockRef.current[itemId] = nextStock;
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to adjust item stock");
    } finally {
      setUpdatingItemId("");
    }
  }, []);

  const handleAddItem = useCallback(
    async (event) => {
      event.preventDefault();
      if (!storeId) return;

      const itemName = newItemForm.itemName.trim();
      const price = Number(newItemForm.price);
      const stock = Number(newItemForm.stock);

      if (!itemName || !Number.isFinite(price) || price <= 0 || !Number.isFinite(stock) || stock < 0) {
        toast.error("Enter valid item name, price, and stock");
        return;
      }

      const payload = {
        itemName,
        description: newItemForm.description.trim(),
        price,
        stock,
        category: newItemForm.category.trim() || "General",
        sku: newItemForm.sku.trim() || createGeneratedSku(itemName),
        image: newItemForm.image.trim(),
        specifications: [],
      };

      try {
        setAddingItem(true);
        const { data } = await axios.post(`/items/add/${storeId}`, payload);
        if (data?.item?._id) {
          setItems((currentItems) => [data.item, ...currentItems]);
        } else {
          await fetchItems();
        }

        setNewItemForm({
          itemName: "",
          description: "",
          price: "",
          stock: "",
          category: "General",
          sku: "",
          image: "",
        });
        toast.success("Item added successfully");
      } catch (error) {
        toast.error(error?.response?.data?.message || "Failed to add item");
      } finally {
        setAddingItem(false);
      }
    },
    [fetchItems, newItemForm, storeId],
  );

  const handleDownloadInventoryTemplate = useCallback(() => {
    const csvContent = INVENTORY_TEMPLATE_ROWS.map((row) => row.join(",")).join("\n");
    const downloadAnchor = document.createElement("a");
    downloadAnchor.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
    downloadAnchor.download = "store_items_template.csv";
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  }, []);

  const handleExcelImport = useCallback(
    async (event) => {
      const selectedFile = event.target.files?.[0];
      event.target.value = "";
      if (!selectedFile || !storeId) return;

      try {
        setImportingItems(true);
        const formData = new FormData();
        formData.append("file", selectedFile);

        const { data } = await axios.post(`/items/import/${storeId}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        await fetchItems();
        toast.success(
          typeof data?.importedCount === "number"
            ? `${data.importedCount} items imported successfully`
            : "Items imported successfully",
        );
      } catch (error) {
        toast.error(error?.response?.data?.message || "Failed to import items");
      } finally {
        setImportingItems(false);
      }
    },
    [fetchItems, storeId],
  );

  const incomingOrders = useMemo(
    () => sortByNewest(orders.filter((order) => order.status === "pending")),
    [orders],
  );

  const preparingOrders = useMemo(
    () => sortByNewest(orders.filter((order) => order.status === "confirmed")),
    [orders],
  );

  const dispatchedOrders = useMemo(
    () =>
      sortByNewest(
        orders.filter((order) => ["shipped", "in_transit"].includes(order.status)),
      ),
    [orders],
  );

  const todayDeliveredOrders = useMemo(() => {
    const now = new Date();

    return orders.filter((order) => {
      if (order.status !== "delivered") return false;
      const completedDate = new Date(order.deliveredAt || order.updatedAt || order.createdAt);
      if (!Number.isFinite(completedDate.getTime())) return false;
      return isSameDate(completedDate, now);
    });
  }, [orders]);

  const metrics = useMemo(() => {
    const totalRevenueToday = todayDeliveredOrders.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0,
    );

    const pendingOrders = orders.filter((order) => ["pending", "confirmed"].includes(order.status)).length;

    return {
      totalRevenueToday,
      pendingOrders,
      completedDeliveries: todayDeliveredOrders.length,
    };
  }, [orders, todayDeliveredOrders]);

  const availablePartnerOptions = useMemo(
    () => partners.filter((partner) => partner?.isAvailable),
    [partners],
  );

  const inventorySummary = useMemo(() => {
    const inStock = items.filter((item) => Number(item?.stock || 0) > 0).length;
    return {
      total: items.length,
      inStock,
      outOfStock: items.length - inStock,
    };
  }, [items]);

  const inventoryCategories = useMemo(() => {
    const categorySet = new Set(
      items.map((item) => String(item?.category || "General").trim()).filter(Boolean),
    );
    return ["All", ...Array.from(categorySet).sort((firstCategory, secondCategory) => firstCategory.localeCompare(secondCategory))];
  }, [items]);

  const filteredInventoryItems = useMemo(() => {
    const normalizedQuery = inventoryQuery.trim().toLowerCase();

    return items
      .filter((item) => {
        const matchesCategory =
          inventoryCategory === "All" ||
          String(item?.category || "General").toLowerCase() === inventoryCategory.toLowerCase();

        const matchesQuery =
          !normalizedQuery ||
          [item?.itemName, item?.description, item?.sku, item?.category]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedQuery));

        return matchesCategory && matchesQuery;
      })
      .sort((firstItem, secondItem) => String(firstItem?.itemName || "").localeCompare(String(secondItem?.itemName || "")));
  }, [inventoryCategory, inventoryQuery, items]);

  if (userRole && userRole !== "store") {
    return (
      <section className="min-h-screen bg-slate-100 p-4">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-900">Store access only</p>
          <p className="mt-2 text-sm text-slate-600">
            Please login with a store account to access this command center.
          </p>
        </div>
      </section>
    );
  }

  if (!storeId) {
    return (
      <section className="min-h-screen bg-slate-100 p-4">
        <div className="mx-auto flex max-w-3xl items-center justify-center rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
          <Loader2 className="mr-2 animate-spin text-slate-500" size={18} />
          <span className="text-sm text-slate-600">Loading store dashboard...</span>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-slate-100 p-4 pb-10 lg:p-6">
      <div className="mx-auto w-full max-w-[1600px] space-y-5">
        <MotionHeader
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700">Order Command Center</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">{user?.storeName || "Store"}</h1>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    socketConnected ? "bg-emerald-500" : "bg-slate-400"
                  }`}
                />
                {socketConnected ? "Realtime Connected" : "Realtime Reconnecting"}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={refreshDashboard}
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                <RefreshCw size={16} />
                Refresh
              </button>

              <button
                type="button"
                onClick={() => setInventoryOpen(true)}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Boxes size={16} />
                Inventory
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              icon={Wallet}
              label="Total Revenue Today"
              value={formatCurrency(metrics.totalRevenueToday)}
              hint="Delivered orders completed today"
            />
            <MetricCard
              icon={ClipboardList}
              label="Pending Orders"
              value={String(metrics.pendingOrders)}
              hint="Incoming and preparing orders"
            />
            <MetricCard
              icon={PackageCheck}
              label="Completed Deliveries"
              value={String(metrics.completedDeliveries)}
              hint="Delivered today"
            />
          </div>
        </MotionHeader>

        <div className="grid gap-4 xl:grid-cols-3">
          <ColumnShell
            title="Incoming"
            subtitle="New orders awaiting store confirmation"
            count={incomingOrders.length}
          >
            {loadingOrders ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Loading incoming orders...
              </div>
            ) : incomingOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                No incoming orders right now.
              </div>
            ) : (
              incomingOrders.map((order) => {
                const badge = getStatusBadge(order);
                const orderAgeMinutes = minutesFromNow(order.createdAt);

                return (
                  <MotionArticle
                    key={order._id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16 }}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{order.orderId || order._id}</p>
                        <p className="text-xs text-slate-500">{order.clientName || "Customer"}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p>Amount</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(order.totalAmount)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p>Items</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{order.items?.length || 0}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <AlertTriangle size={13} className={orderAgeMinutes >= OVERDUE_MINUTES ? "text-rose-600" : "text-slate-400"} />
                      {orderAgeMinutes} min since placed
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={updatingOrderId === order._id}
                        onClick={() => handleAcceptOrder(order._id)}
                        className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 animate-pulse"
                      >
                        {updatingOrderId === order._id ? "Accepting..." : "Accept"}
                      </button>
                      <button
                        type="button"
                        disabled={updatingOrderId === order._id}
                        onClick={() => handleDeclineOrder(order._id)}
                        className="inline-flex h-12 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Decline
                      </button>
                    </div>
                  </MotionArticle>
                );
              })
            )}
          </ColumnShell>

          <ColumnShell
            title="Preparing"
            subtitle="Orders in kitchen and packaging workflow"
            count={preparingOrders.length}
          >
            {loadingOrders ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Loading preparing orders...
              </div>
            ) : preparingOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                No preparing orders currently.
              </div>
            ) : (
              preparingOrders.map((order) => {
                const badge = getStatusBadge(order);
                const partnerMeta = resolveOrderPartner(order);
                const selectedPartnerId = selectedPartnerByOrder[order._id] || partnerMeta.partnerId;

                return (
                  <MotionArticle
                    key={order._id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16 }}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{order.orderId || order._id}</p>
                        <p className="text-xs text-slate-500">{order.clientName || "Customer"}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Assign Partner</p>
                      <select
                        value={selectedPartnerId}
                        onChange={(event) =>
                          setSelectedPartnerByOrder((currentMap) => ({
                            ...currentMap,
                            [order._id]: event.target.value,
                          }))
                        }
                        className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400"
                        disabled={loadingPartners}
                      >
                        <option value="">Select available partner</option>
                        {availablePartnerOptions.map((partner) => (
                          <option key={partner._id} value={partner._id}>
                            {partner.name} ({partner.vehicle})
                          </option>
                        ))}
                      </select>
                      {!availablePartnerOptions.length && !loadingPartners ? (
                        <p className="mt-2 text-xs text-amber-700">No available partners at the moment.</p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      disabled={updatingOrderId === order._id || !selectedPartnerId}
                      onClick={() => handleMarkReady(order)}
                      className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle2 size={16} />
                      {updatingOrderId === order._id ? "Updating..." : "Mark as Ready"}
                    </button>
                  </MotionArticle>
                );
              })
            )}
          </ColumnShell>

          <ColumnShell
            title="Dispatched / Ready"
            subtitle="Orders awaiting pickup or already with partner"
            count={dispatchedOrders.length}
          >
            {loadingOrders ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Loading dispatched orders...
              </div>
            ) : dispatchedOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                No dispatched orders right now.
              </div>
            ) : (
              dispatchedOrders.map((order) => {
                const badge = getStatusBadge(order);
                const partnerMeta = resolveOrderPartner(order);
                const currentPartnerLocation = toLocation(order.partnerCurrentLocation);
                const destinationLocation = resolveMapDestination(order, storeLocation);
                const canShowMap = Boolean(currentPartnerLocation && destinationLocation);

                return (
                  <MotionArticle
                    key={order._id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16 }}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{order.orderId || order._id}</p>
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-600">
                          <Truck size={12} />
                          {partnerMeta.name} - {partnerMeta.vehicle}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>

                    {canShowMap ? (
                      <div className="mt-3 space-y-2">
                        <LiveRouteMap
                          startLocation={currentPartnerLocation}
                          currentLocation={currentPartnerLocation}
                          endLocation={destinationLocation}
                          heightClassName="h-52"
                          currentMarkerStyle="bike"
                        />
                        <p className="text-xs text-slate-500">
                          {order.status === "shipped"
                            ? "Partner is moving toward store pickup point."
                            : "Partner route is tracked in real time."}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
                        Partner tracking map is unavailable until location data is received.
                      </div>
                    )}
                  </MotionArticle>
                );
              })
            )}
          </ColumnShell>
        </div>
      </div>

      <AnimatePresence>
        {inventoryOpen && (
          <>
            <MotionDiv
              className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInventoryOpen(false)}
            />

            <MotionAside
              initial={{ opacity: 0, y: 24, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.99 }}
              transition={{ type: "spring", stiffness: 240, damping: 24 }}
              className="fixed inset-0 z-50 flex min-h-screen flex-col bg-slate-100"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-indigo-700">Inventory Workspace</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">Stock Management</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInventoryOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid min-h-0 flex-1 lg:grid-cols-[420px_minmax(0,1fr)]">
                <div className="min-h-0 overflow-y-auto border-b border-slate-200 bg-white p-4 lg:border-b-0 lg:border-r lg:p-5">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => excelInputRef.current?.click()}
                        disabled={importingItems}
                        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Upload size={14} />
                        {importingItems ? "Importing..." : "Import Excel"}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadInventoryTemplate}
                        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Download size={14} />
                        Template
                      </button>
                      <input
                        ref={excelInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv,.ods"
                        className="hidden"
                        onChange={handleExcelImport}
                      />
                    </div>

                    <form onSubmit={handleAddItem} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center gap-2">
                        <PackagePlus size={15} className="text-slate-600" />
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Add Item</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Item name"
                          value={newItemForm.itemName}
                          onChange={(event) =>
                            setNewItemForm((currentForm) => ({ ...currentForm, itemName: event.target.value }))
                          }
                          className="col-span-2 h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-indigo-400"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Price"
                          value={newItemForm.price}
                          onChange={(event) =>
                            setNewItemForm((currentForm) => ({ ...currentForm, price: event.target.value }))
                          }
                          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-indigo-400"
                        />
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="Stock"
                          value={newItemForm.stock}
                          onChange={(event) =>
                            setNewItemForm((currentForm) => ({ ...currentForm, stock: event.target.value }))
                          }
                          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-indigo-400"
                        />
                        <input
                          type="text"
                          placeholder="Category"
                          value={newItemForm.category}
                          onChange={(event) =>
                            setNewItemForm((currentForm) => ({ ...currentForm, category: event.target.value }))
                          }
                          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-indigo-400"
                        />
                        <input
                          type="text"
                          placeholder="SKU (optional)"
                          value={newItemForm.sku}
                          onChange={(event) =>
                            setNewItemForm((currentForm) => ({ ...currentForm, sku: event.target.value }))
                          }
                          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-indigo-400"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={addingItem}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {addingItem ? <Loader2 size={14} className="animate-spin" /> : <PackagePlus size={14} />}
                        {addingItem ? "Adding..." : "Add Inventory Item"}
                      </button>
                    </form>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-slate-100 p-2">
                        <p className="text-slate-500">Items</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{inventorySummary.total}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 p-2">
                        <p className="text-emerald-700">In Stock</p>
                        <p className="mt-1 text-sm font-semibold text-emerald-800">{inventorySummary.inStock}</p>
                      </div>
                      <div className="rounded-lg bg-rose-50 p-2">
                        <p className="text-rose-700">Out</p>
                        <p className="mt-1 text-sm font-semibold text-rose-800">{inventorySummary.outOfStock}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex flex-col overflow-hidden p-4 lg:p-5">
                  <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label className="relative sm:col-span-2">
                      <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search items..."
                        value={inventoryQuery}
                        onChange={(event) => setInventoryQuery(event.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-sm outline-none focus:border-indigo-400"
                      />
                    </label>
                    <select
                      value={inventoryCategory}
                      onChange={(event) => setInventoryCategory(event.target.value)}
                      className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-indigo-400"
                    >
                      {inventoryCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
                    {loadingItems ? (
                      <div className="p-6 text-sm text-slate-600">Loading inventory...</div>
                    ) : filteredInventoryItems.length === 0 ? (
                      <div className="p-8 text-center text-sm text-slate-600">No matching inventory items found.</div>
                    ) : (
                      <table className="min-w-full">
                        <thead className="sticky top-0 z-10 bg-slate-50">
                          <tr className="text-left text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
                            <th className="px-3 py-2">Item</th>
                            <th className="px-3 py-2">Category</th>
                            <th className="px-3 py-2">Price</th>
                            <th className="px-3 py-2">Stock</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {filteredInventoryItems.map((item) => {
                            const itemId = String(item._id);
                            const isInStock = Number(item.stock || 0) > 0;

                            return (
                              <tr key={itemId} className="text-sm text-slate-700">
                                <td className="px-3 py-3">
                                  <p className="font-semibold text-slate-900">{item.itemName}</p>
                                  <p className="text-xs text-slate-500">SKU: {item.sku || "-"}</p>
                                </td>
                                <td className="px-3 py-3 text-xs">{item.category || "General"}</td>
                                <td className="px-3 py-3">{formatCurrency(item.price)}</td>
                                <td className="px-3 py-3">{item.stock}</td>
                                <td className="px-3 py-3">
                                  {updatingItemId === itemId ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                                      <Loader2 size={12} className="animate-spin" />
                                      Updating
                                    </span>
                                  ) : isInStock ? (
                                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">In Stock</span>
                                  ) : (
                                    <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">Out of Stock</span>
                                  )}
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={updatingItemId === itemId || Number(item.stock || 0) <= 0}
                                      onClick={() => handleAdjustItemStock(item, -1)}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      -
                                    </button>
                                    <button
                                      type="button"
                                      disabled={updatingItemId === itemId}
                                      onClick={() => handleAdjustItemStock(item, 1)}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      +
                                    </button>
                                    <button
                                      type="button"
                                      disabled={updatingItemId === itemId}
                                      onClick={() => handleToggleItemStock(item)}
                                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                                        isInStock ? "bg-emerald-500" : "bg-slate-300"
                                      } ${updatingItemId === itemId ? "opacity-60" : ""}`}
                                      aria-label={`Toggle stock for ${item.itemName}`}
                                    >
                                      <span
                                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                          isInStock ? "translate-x-5" : "translate-x-1"
                                        }`}
                                      />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </MotionAside>
          </>
        )}
      </AnimatePresence>
    </section>
  );
};

export default StoreDashboard;
