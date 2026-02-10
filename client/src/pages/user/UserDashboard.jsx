import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppContext } from "../../context/AppContext";
import axios from "axios";
import { toast } from "react-toastify";
import DeliveryLocationPicker from "../../components/DeliveryLocationPicker";
import LiveRouteMap from "../../components/LiveRouteMap";

const ORDER_STATUS_FLOW = [
  "pending",
  "confirmed",
  "shipped",
  "in_transit",
  "delivered",
];

const ORDER_STATUS_LABELS = {
  pending: "Order Received",
  confirmed: "Preparing",
  shipped: "Partner Assigned",
  in_transit: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

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
    script.addEventListener("error", () =>
      reject(new Error("Socket client failed to load")),
    );
    document.body.appendChild(script);
  });

const UserDashboard = () => {
  const { user, token } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState("shop");
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [specifications, setSpecifications] = useState([]);
  const [selectedSpecification, setSelectedSpecification] = useState("All");
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tracking, setTracking] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedItemDetails, setSelectedItemDetails] = useState(null);
  const [viewMode, setViewMode] = useState(2); // 1, 2, or "list"
  const [showProductModal, setShowProductModal] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({
    deliveryAddress: "",
    clientPhone: "",
  });
  const [deliveryLocation, setDeliveryLocation] = useState(() => {
    const saved = localStorage.getItem("userDeliveryLocation");
    if (!saved) return null;

    try {
      const parsed = JSON.parse(saved);
      if (Number.isFinite(parsed?.lat) && Number.isFinite(parsed?.lng)) {
        return {
          lat: Number(parsed.lat),
          lng: Number(parsed.lng),
        };
      }
    } catch {
      return null;
    }

    return null;
  });
  const [placingOrder, setPlacingOrder] = useState(false);
  const socketRef = useRef(null);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("userCart");
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("userCart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (deliveryLocation) {
      localStorage.setItem("userDeliveryLocation", JSON.stringify(deliveryLocation));
      return;
    }

    localStorage.removeItem("userDeliveryLocation");
  }, [deliveryLocation]);

  // Fetch stores and categories
  useEffect(() => {
    const fetchStores = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get("/stores/all");
        setStores(data.stores || []);
      } catch {
        toast.error("Failed to fetch stores");
      } finally {
        setLoading(false);
      }
    };

    const fetchCategories = async () => {
      try {
        const { data } = await axios.get("/items/categories/all");
        if (data.categories && Array.isArray(data.categories)) {
          setCategories(["All", ...data.categories]);
        } else {
          setCategories(["All"]);
        }
      } catch (error) {
        console.log("Failed to fetch categories:", error);
        setCategories(["All"]);
      }
    };

    const fetchSpecifications = async () => {
      try {
        const { data } = await axios.get("/items/specifications/all");
        if (data.specifications && Array.isArray(data.specifications)) {
          setSpecifications(["All", ...data.specifications]);
        } else {
          setSpecifications(["All"]);
        }
      } catch (error) {
        console.log("Failed to fetch specifications:", error);
        setSpecifications(["All"]);
      }
    };

    fetchStores();
    fetchCategories();
    fetchSpecifications();
  }, []);

  // Fetch items from selected store
  useEffect(() => {
    if (selectedStore && selectedStore !== "all") {
      fetchItems();
    }
  }, [selectedStore]);

  // Global search and filter logic
  useEffect(() => {
    if (selectedStore === "all") {
      // Global search across all stores
      if (selectedCategory !== "All" || selectedSpecification !== "All") {
        // Category or specification selected - browse globally then filter client-side.
        performCategoryBrowse();
      } else if (searchQuery.trim()) {
        // Search query entered - search globally
        performGlobalSearch();
      } else {
        // Default browsing for all stores without strict filters.
        performCategoryBrowse();
      }
    } else {
      // Search within selected store
      if (searchQuery.trim() === "") {
        filterByCategory(items);
      } else {
        const query = searchQuery.toLowerCase();
        const filtered = items.filter(
          (item) =>
            item.itemName.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query) ||
            (item.specifications &&
              item.specifications.some((spec) =>
                spec.toLowerCase().includes(query)
              ))
        );
        filterByCategory(filtered);
      }
    }
  }, [searchQuery, items, selectedStore, selectedCategory, selectedSpecification]);

  // Filter items by category and specifications
  // Deduplicate items by SKU and filter out items with no stock
  const deduplicateItems = (itemsToFilter) => {
    const seen = new Set();
    return itemsToFilter.filter((item) => {
      const sku = item.sku || item._id; // Use SKU or fallback to _id
      // Only include items that are in stock and haven't been seen yet
      if (item.stock > 0 && !seen.has(sku)) {
        seen.add(sku);
        return true;
      }
      return false;
    });
  };

  const filterByCategory = (itemsToFilter) => {
    // First deduplicate items
    let deduped = deduplicateItems(itemsToFilter);
    let filtered = deduped;
    
    // Filter by category
    if (selectedCategory !== "All") {
      filtered = filtered.filter(
        (item) => item.category === selectedCategory
      );
    }
    
    // Filter by specification (partial match, case-insensitive)
    if (selectedSpecification !== "All" && selectedSpecification.trim() !== "") {
      const specQuery = selectedSpecification.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.specifications &&
          item.specifications.some((spec) =>
            spec.toLowerCase().includes(specQuery)
          )
      );
    }
    
    setFilteredItems(filtered);
  };

  // Perform global search
  const performGlobalSearch = async () => {
    if (!searchQuery.trim()) {
      setFilteredItems([]);
      return;
    }

    try {
      setLoading(true);
      const query = new URLSearchParams({
        query: searchQuery,
        category: selectedCategory === "All" ? "" : selectedCategory,
      });
      const { data } = await axios.get(`/items/search/global?${query}`);
      // Apply deduplication and stock filtering to search results
      const deduped = deduplicateItems(data.items || []);
      filterByCategory(deduped);
    } catch {
      toast.error("Global search failed");
      setFilteredItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Browse all items by category (no search term required)
  const performCategoryBrowse = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        query: "", // Empty search query
        category: selectedCategory,
      });
      const { data } = await axios.get(`/items/search/global?${query}`);
      // Apply deduplication and stock filtering to category results
      const deduped = deduplicateItems(data.items || []);
      filterByCategory(deduped);
    } catch (error) {
      console.log("Category browse failed:", error);
      setFilteredItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch items from store
  const fetchItems = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`/items/${selectedStore}`);
      setItems(data.items || []);
      filterByCategory(data.items || []);
    } catch {
      toast.error("Failed to fetch items");
    } finally {
      setLoading(false);
    }
  };

  // Fetch user's orders
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`/orders/user/${user.id}`);
      setOrders(data.orders || []);
    } catch {
      toast.error("Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  // Fetch tracking info
  const fetchTracking = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`/orders/tracking/${user.id}`);
      setTracking(data.tracking || []);
    } catch {
      // Tracking might not have orders yet, so don't show error
      setTracking([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchOrders();
      fetchTracking();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!token || !user?.id) return;

    let socket;

    const upsertOrder = (prev, nextOrder) => {
      const withoutCurrent = prev.filter((existing) => existing._id !== nextOrder._id);
      return [nextOrder, ...withoutCurrent];
    };
    const mergePartnerLocation = (prev, orderId, partnerCurrentLocation) =>
      prev.map((existing) =>
        existing._id === orderId
          ? {
              ...existing,
              partnerCurrentLocation,
            }
          : existing,
      );

    const connectSocket = async () => {
      try {
        const ioClient = await loadSocketClient();
        socket = ioClient(import.meta.env.VITE_BACKEND_URL || "http://localhost:5000", {
          transports: ["websocket"],
          auth: { token },
        });

        socketRef.current = socket;

        socket.on("connect", () => {
          socket.emit("join:user", user.id);
        });

        socket.on("order:user:tracking", ({ order }) => {
          if (!order?._id) return;

          setOrders((prev) => upsertOrder(prev, order));
          if (order.status === "delivered" || order.status === "cancelled") {
            setTracking((prev) => prev.filter((existing) => existing._id !== order._id));
          } else {
            setTracking((prev) => upsertOrder(prev, order));
          }
        });

        socket.on("order:user:partner-location", ({ orderId, partnerCurrentLocation }) => {
          if (!orderId || !partnerCurrentLocation) return;

          setOrders((prev) => mergePartnerLocation(prev, orderId, partnerCurrentLocation));
          setTracking((prev) => mergePartnerLocation(prev, orderId, partnerCurrentLocation));
        });
      } catch {
        // Real-time channel is optional for dashboard availability.
      }
    };

    connectSocket();

    return () => {
      if (socket) socket.disconnect();
    };
  }, [token, user?.id]);

  // Add item to cart
  const addToCart = (item) => {
    const existingItem = cart.find((c) => c._id === item._id);
    if (existingItem) {
      setCart(
        cart.map((c) =>
          c._id === item._id ? { ...c, quantity: c.quantity + 1 } : c
        )
      );
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
    toast.success(`${item.itemName} added to cart!`);
  };

  // Update cart quantity
  const updateCartQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
    } else {
      setCart(
        cart.map((item) =>
          item._id === itemId ? { ...item, quantity } : item
        )
      );
    }
  };

  // Remove from cart
  const removeFromCart = (itemId) => {
    setCart(cart.filter((item) => item._id !== itemId));
    toast.info("Item removed from cart");
  };

  const getStoreIdFromItem = (item) => {
    if (!item?.storeId) {
      return selectedStore !== "all" ? selectedStore : null;
    }

    if (typeof item.storeId === "string") return item.storeId;
    return item.storeId?._id || null;
  };

  const cartBreakdown = useMemo(() => {
    const storeMap = new Map();

    cart.forEach((item) => {
      const storeId = getStoreIdFromItem(item) || "unknown";
      const knownStore = stores.find((store) => store._id === storeId);
      const existing = storeMap.get(storeId) || {
        storeId,
        storeName: item.storeId?.storeName || knownStore?.storeName || "Store",
        lineItems: 0,
        total: 0,
      };

      existing.lineItems += item.quantity;
      existing.total += Number(item.price) * item.quantity;
      storeMap.set(storeId, existing);
    });

    return Array.from(storeMap.values());
  }, [cart, selectedStore, stores]);

  const placeOrder = async () => {
    if (!cart.length) {
      toast.error("Your cart is empty");
      return;
    }

    if (!checkoutForm.deliveryAddress.trim()) {
      toast.error("Delivery address is required");
      return;
    }

    if (!checkoutForm.clientPhone.trim()) {
      toast.error("Phone number is required");
      return;
    }

    const groupedItems = new Map();
    for (const item of cart) {
      const storeId = getStoreIdFromItem(item);
      if (!storeId) {
        toast.error("Unable to detect store for one or more items");
        return;
      }

      if (!groupedItems.has(storeId)) groupedItems.set(storeId, []);
      groupedItems.get(storeId).push(item);
    }

    try {
      setPlacingOrder(true);

      const requests = Array.from(groupedItems.entries()).map(([storeId, storeItems]) => {
        const payloadItems = storeItems.map((item) => ({
          itemId: item._id,
          itemName: item.itemName,
          quantity: item.quantity,
          price: Number(item.price),
          subtotal: Number(item.price) * item.quantity,
        }));

        const totalAmount = payloadItems.reduce((sum, item) => sum + item.subtotal, 0);

        return axios.post(`/orders/create/${storeId}`, {
          storeId,
          clientId: user.id,
          items: payloadItems,
          totalAmount,
          deliveryAddress: checkoutForm.deliveryAddress.trim(),
          customerLocation: deliveryLocation
            ? {
                lat: deliveryLocation.lat,
                lng: deliveryLocation.lng,
                label: checkoutForm.deliveryAddress.trim(),
              }
            : undefined,
          clientName: user.name,
          clientPhone: checkoutForm.clientPhone.trim(),
        });
      });

      await Promise.all(requests);

      setCart([]);
      setCartOpen(false);
      setActiveTab("tracking");
      setCheckoutForm((prev) => ({ ...prev, deliveryAddress: "" }));
      setDeliveryLocation(null);

      await Promise.all([fetchOrders(), fetchTracking()]);
      toast.success(
        requests.length > 1
          ? `Placed ${requests.length} orders across multiple stores`
          : "Order placed successfully",
      );
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to place order");
    } finally {
      setPlacingOrder(false);
    }
  };

  const reorderOrder = (order) => {
    if (!order?.items?.length) {
      toast.info("No items found for reorder");
      return;
    }

    const storeId =
      typeof order.storeId === "string" ? order.storeId : order.storeId?._id || selectedStore;

    setCart((prev) => {
      const next = [...prev];

      order.items.forEach((item) => {
        const id =
          typeof item.itemId === "string" ? item.itemId : item.itemId?._id || item._id;
        if (!id) return;

        const existingIndex = next.findIndex((cartItem) => cartItem._id === id);
        if (existingIndex > -1) {
          next[existingIndex] = {
            ...next[existingIndex],
            quantity: next[existingIndex].quantity + Number(item.quantity || 1),
          };
          return;
        }

        next.push({
          _id: id,
          itemName: item.itemName,
          price: Number(item.price || 0),
          quantity: Number(item.quantity || 1),
          image: "",
          storeId,
          stock: Number(item.quantity || 1),
        });
      });

      return next;
    });

    setCartOpen(true);
    setActiveTab("shop");
    toast.success("Order items added to cart");
  };

  const getOrderProgress = (status) => {
    const normalizedStatus = status || "pending";
    const index = ORDER_STATUS_FLOW.indexOf(normalizedStatus);
    if (index < 0) return 0;
    return Math.round(((index + 1) / ORDER_STATUS_FLOW.length) * 100);
  };

  // Calculate cart totals
  const cartTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const cartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const orderCount = orders.length;
  const trackingCount = tracking.length;
  const storeCount = stores.length;

  // Extract first name
  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                Welcome, {firstName}
              </h1>
              <p className="text-sm text-gray-500">
                Browse stores, manage your cart, and track deliveries in one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setActiveTab("shop");
                  setCartOpen(false);
                }}
                className={`px-3 sm:px-4 py-2 rounded text-sm font-medium transition ${
                  activeTab === "shop"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Shop
              </button>
              <button
                onClick={() => {
                  setActiveTab("orders");
                  fetchOrders();
                  setCartOpen(false);
                }}
                className={`px-3 sm:px-4 py-2 rounded text-sm font-medium transition ${
                  activeTab === "orders"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Orders
              </button>
              <button
                onClick={() => {
                  setActiveTab("tracking");
                  fetchTracking();
                  setCartOpen(false);
                }}
                className={`px-3 sm:px-4 py-2 rounded text-sm font-medium transition ${
                  activeTab === "tracking"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Track
              </button>
              <button
                onClick={() => {
                  setCartOpen(!cartOpen);
                  setActiveTab("shop");
                }}
                className="relative bg-blue-500 text-white px-3 sm:px-4 py-2 rounded hover:bg-blue-600 transition cursor-pointer text-sm sm:text-base whitespace-nowrap"
              >
                Cart ({cartItems})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-gray-100 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Stores</p>
              <p className="text-lg font-semibold text-gray-900">
                {loading ? "--" : storeCount}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Cart Items</p>
              <p className="text-lg font-semibold text-gray-900">{cartItems}</p>
            </div>
            <div className="rounded-lg border border-gray-100 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Orders</p>
              <p className="text-lg font-semibold text-gray-900">{orderCount}</p>
            </div>
            <div className="rounded-lg border border-gray-100 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Active Tracks</p>
              <p className="text-lg font-semibold text-gray-900">{trackingCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs - Mobile Scrollable */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4 sm:mt-6">
        <div className="flex gap-2 sm:gap-4 border-b mb-6 overflow-x-auto pb-2 sm:pb-0 flex-nowrap">
          <button
            onClick={() => {
              setActiveTab("shop");
              setCartOpen(false);
            }}
            className={`px-3 sm:px-6 py-2 sm:py-3 font-semibold border-b-2 transition cursor-pointer text-sm sm:text-base whitespace-nowrap ${
              activeTab === "shop"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            🛍️ Shop
          </button>
          <button
            onClick={() => {
              setActiveTab("orders");
              fetchOrders();
              setCartOpen(false);
            }}
            className={`px-3 sm:px-6 py-2 sm:py-3 font-semibold border-b-2 transition cursor-pointer text-sm sm:text-base whitespace-nowrap ${
              activeTab === "orders"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            📋 Orders
          </button>
          <button
            onClick={() => {
              setActiveTab("tracking");
              fetchTracking();
              setCartOpen(false);
            }}
            className={`px-3 sm:px-6 py-2 sm:py-3 font-semibold border-b-2 transition cursor-pointer text-sm sm:text-base whitespace-nowrap ${
              activeTab === "tracking"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            📍 Track
          </button>
        </div>

        {/* Loading or No Stores */}
        {loading && !stores.length && activeTab === "shop" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <div className="text-center text-gray-500">
              <p className="mb-2">Loading your shops...</p>
              <p className="text-sm">Please wait while we fetch available stores.</p>
            </div>
          </div>
        )}

        {!loading && !stores.length && activeTab === "shop" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <div className="text-center text-gray-500">
              <p className="mb-2">No stores available</p>
              <p className="text-sm">Sorry, there are no stores to browse right now. Please try again later.</p>
            </div>
          </div>
        )}

        {/* SHOP TAB */}
        {activeTab === "shop" && !cartOpen && stores.length > 0 && (
          <div>
            {/* Search Bar */}
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow mb-4 sm:mb-6">
              {/* Search Input */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder={
                    selectedStore === "all"
                      ? "Search all items, stores, categories..."
                      : "Search in selected store..."
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border rounded px-3 sm:px-4 py-2 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* Sidebar Filters - Hidden on Mobile */}
              <div className="hidden lg:block bg-white p-4 sm:p-6 rounded-lg shadow h-fit">
                <h3 className="text-lg font-semibold mb-4">Filters</h3>

                {/* Store Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold mb-2">
                    Store
                  </label>
                  <select
                    value={selectedStore}
                    onChange={(e) => setSelectedStore(e.target.value)}
                    className="w-full border rounded px-3 py-2 cursor-pointer focus:outline-none focus:border-blue-500 text-sm"
                  >
                    <option value="all">🌐 All Stores</option>
                    {stores.map((store) => (
                      <option key={store._id} value={store._id}>
                        {store.storeName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Category
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full border rounded px-3 py-2 cursor-pointer focus:outline-none focus:border-blue-500 text-sm"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Specifications Filter */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Specifications
                  </label>
                  <select
                    value={selectedSpecification}
                    onChange={(e) => setSelectedSpecification(e.target.value)}
                    className="w-full border rounded px-3 py-2 cursor-pointer focus:outline-none focus:border-blue-500 text-sm"
                  >
                    {specifications.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mobile Filters */}
              <div className="lg:hidden bg-white p-4 rounded-lg shadow space-y-3 mb-4">
                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Store
                  </label>
                  <select
                    value={selectedStore}
                    onChange={(e) => setSelectedStore(e.target.value)}
                    className="w-full border rounded px-3 py-2 cursor-pointer focus:outline-none focus:border-blue-500 text-sm"
                  >
                    <option value="all">🌐 All Stores</option>
                    {stores.map((store) => (
                      <option key={store._id} value={store._id}>
                        {store.storeName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Category
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full border rounded px-3 py-2 cursor-pointer focus:outline-none focus:border-blue-500 text-sm"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Specifications
                  </label>
                  <select
                    value={selectedSpecification}
                    onChange={(e) => setSelectedSpecification(e.target.value)}
                    className="w-full border rounded px-3 py-2 cursor-pointer focus:outline-none focus:border-blue-500 text-sm"
                  >
                    {specifications.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Items Grid */}
            <div className="lg:col-span-3">
              {/* View Mode Toggle */}
              {filteredItems.length > 0 && (
                <div className="mb-4 flex gap-2 justify-end">
                  <button
                    onClick={() => setViewMode(1)}
                    className={`px-3 py-2 rounded text-sm font-medium whitespace-nowrap transition ${
                      viewMode === 1
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    📱 Single
                  </button>
                  <button
                    onClick={() => setViewMode(2)}
                    className={`px-3 py-2 rounded text-sm font-medium whitespace-nowrap transition ${
                      viewMode === 2
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    📊 2 Col
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`px-3 py-2 rounded text-sm font-medium whitespace-nowrap transition ${
                      viewMode === "list"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    📋 List
                  </button>
                </div>
              )}

              {loading && filteredItems.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  Loading items...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  {selectedStore === "all" ? (
                    selectedCategory === "All" ? (
                      "Select a category or enter a search term to browse items"
                    ) : (
                      `No items found in ${selectedCategory} category`
                    )
                  ) : (
                    searchQuery ? "No items match your search" : "No items available"
                  )}
                </div>
              ) : viewMode === "list" ? (
                // List View
                <div className="space-y-3">
                  {filteredItems.map((item) => (
                    <div
                      key={item._id}
                      onClick={() => {
                        setSelectedItemDetails(item);
                        setShowProductModal(true);
                      }}
                      className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden cursor-pointer flex gap-4 p-4"
                    >
                      {/* Item Image */}
                      <div className="w-24 h-24 bg-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden rounded">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.itemName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-gray-400 text-center text-2xl">📦</div>
                        )}
                      </div>
                      {/* Item Details */}
                      <div className="flex-grow">
                        <h3 className="font-semibold text-base mb-1 line-clamp-1">
                          {item.itemName}
                        </h3>
                        <p className="text-xs text-gray-600 mb-1">{item.category}</p>
                        {selectedStore === "all" && item.storeId && (
                          <p className="text-xs text-blue-600 font-semibold mb-1">
                            {item.storeId.storeName}
                          </p>
                        )}
                        <p className="text-xs text-gray-700 mb-2 line-clamp-1">
                          {item.description}
                        </p>
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-blue-600">
                            ${item.price.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Grid View (1 or 2 columns)
                <div
                  className={`grid gap-3 sm:gap-4 ${
                    viewMode === 1
                      ? "grid-cols-1"
                      : "grid-cols-1 sm:grid-cols-2"
                  }`}
                >
                  {filteredItems.map((item) => (
                    <div
                      key={item._id}
                      onClick={() => {
                        setSelectedItemDetails(item);
                        setShowProductModal(true);
                      }}
                      className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden cursor-pointer"
                    >
                      {/* Item Image */}
                      <div className="h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.itemName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-gray-400 text-center">
                            <div className="text-4xl">📦</div>
                            <div className="text-sm">No Image</div>
                          </div>
                        )}
                      </div>

                      {/* Item Details */}
                      <div className="p-3 sm:p-4">
                        <h3 className="font-semibold text-base sm:text-lg mb-1 line-clamp-2">
                          {item.itemName}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600 mb-1">
                          {item.category}
                        </p>

                        {/* Store name for All Stores view */}
                        {selectedStore === "all" && item.storeId && (
                          <p className="text-xs text-blue-600 font-semibold mb-1">
                            {item.storeId.storeName}
                          </p>
                        )}

                        <p className="text-xs sm:text-sm text-gray-700 mb-2 line-clamp-2">
                          {item.description}
                        </p>

                        {/* Specifications */}
                        {item.specifications && item.specifications.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs font-semibold text-gray-700 mb-1">
                              Specs:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {item.specifications.map((spec, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
                                >
                                  {spec}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Price */}
                        <div className="mb-3 gap-2">
                          <span className="text-xl sm:text-2xl font-bold text-blue-600">
                            ${item.price.toFixed(2)}
                          </span>
                        </div>

                        {/* Add to Cart Button */}
                        <button
                          onClick={() => addToCart(item)}
                          disabled={item.stock === 0}
                          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer text-sm sm:text-base font-medium"
                        >
                          🛒 Add to Cart
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PRODUCT DETAIL MODAL */}
        {showProductModal && selectedItemDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
              {/* Header */}
              <div className="flex justify-between items-center p-6 border-b">
                <h2 className="text-2xl font-bold">{selectedItemDetails.itemName}</h2>
                <button
                  onClick={() => {
                    setShowProductModal(false);
                    setSelectedItemDetails(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Image */}
                <div className="flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden h-80 sm:h-96">
                  {selectedItemDetails.image ? (
                    <img
                      src={selectedItemDetails.image}
                      alt={selectedItemDetails.itemName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-gray-400 text-center">
                      <div className="text-6xl">📦</div>
                      <div className="text-sm mt-2">No Image Available</div>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-4">
                  {/* Category & Store */}
                  <div>
                    <p className="text-sm text-gray-600">Category</p>
                    <p className="font-semibold text-lg">{selectedItemDetails.category}</p>
                  </div>

                  {selectedStore === "all" && selectedItemDetails.storeId && (
                    <div>
                      <p className="text-sm text-gray-600">Store</p>
                      <p className="font-semibold text-blue-600">
                        {selectedItemDetails.storeId.storeName}
                      </p>
                    </div>
                  )}

                  {/* Price */}
                  <div>
                    <p className="text-sm text-gray-600">Price</p>
                    <p className="text-3xl font-bold text-blue-600">
                      ${selectedItemDetails.price.toFixed(2)}
                    </p>
                  </div>

                  {/* Description */}
                  <div>
                    <p className="text-sm text-gray-600 font-semibold mb-2">Description</p>
                    <p className="text-gray-700 leading-relaxed">
                      {selectedItemDetails.description || "No description available"}
                    </p>
                  </div>

                  {/* Specifications */}
                  {selectedItemDetails.specifications &&
                    selectedItemDetails.specifications.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-600 font-semibold mb-2">Specifications</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedItemDetails.specifications.map((spec, idx) => (
                            <span
                              key={idx}
                              className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm font-medium"
                            >
                              {spec}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Add to Cart Button */}
                  <button
                    onClick={() => {
                      addToCart(selectedItemDetails);
                      setShowProductModal(false);
                      setSelectedItemDetails(null);
                    }}
                    disabled={selectedItemDetails.stock === 0}
                    className="w-full bg-blue-500 text-white py-3 rounded font-semibold hover:bg-blue-600 transition disabled:bg-gray-400 disabled:cursor-not-allowed text-lg"
                  >
                    {selectedItemDetails.stock > 0 ? "🛒 Add to Cart" : "Out of Stock"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CART SIDEBAR */}
        {cartOpen && (
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl sm:text-2xl font-bold">Shopping Cart</h2>
              <button
                onClick={() => setCartOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Your cart is empty
              </div>
            ) : (
              <>
                {/* Cart Items */}
                <div className="space-y-3 mb-6 max-h-72 sm:max-h-96 overflow-y-auto">
                  {cart.map((item) => (
                    <div
                      key={item._id}
                      className="border rounded p-3 flex gap-3"
                    >
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.itemName}
                          className="w-14 h-14 sm:w-16 sm:h-16 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm sm:text-base line-clamp-1">
                          {item.itemName}
                        </h4>
                        <p className="text-xs sm:text-sm text-gray-600">
                          ${item.price.toFixed(2)} each
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() =>
                              updateCartQuantity(item._id, item.quantity - 1)
                            }
                            className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 cursor-pointer text-sm"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateCartQuantity(item._id, item.quantity + 1)
                            }
                            className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 cursor-pointer text-sm"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeFromCart(item._id)}
                            className="ml-auto text-red-500 hover:text-red-700 font-semibold text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-sm sm:text-base">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Cart Summary */}
                <div className="border-t pt-4 space-y-2">
                  {cartBreakdown.length > 0 && (
                    <div className="rounded border border-gray-200 p-3 space-y-2 mb-3">
                      <p className="text-sm font-semibold text-gray-700">Store Split</p>
                      {cartBreakdown.map((group) => (
                        <div
                          key={group.storeId}
                          className="flex items-center justify-between text-xs sm:text-sm text-gray-600"
                        >
                          <span className="line-clamp-1">{group.storeName}</span>
                          <span>
                            {group.lineItems} items | ${group.total.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2 mb-3">
                    <DeliveryLocationPicker
                      value={deliveryLocation}
                      onChange={setDeliveryLocation}
                      onAddressResolved={(address) =>
                        setCheckoutForm((prev) => ({
                          ...prev,
                          deliveryAddress: address || prev.deliveryAddress,
                        }))
                      }
                    />

                    <input
                      type="text"
                      placeholder="Delivery address"
                      value={checkoutForm.deliveryAddress}
                      onChange={(event) =>
                        setCheckoutForm((prev) => ({
                          ...prev,
                          deliveryAddress: event.target.value,
                        }))
                      }
                      className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="tel"
                      placeholder="Phone number"
                      value={checkoutForm.clientPhone}
                      onChange={(event) =>
                        setCheckoutForm((prev) => ({
                          ...prev,
                          clientPhone: event.target.value,
                        }))
                      }
                      className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex justify-between mb-4">
                    <span className="font-semibold text-base">Total:</span>
                    <span className="text-xl sm:text-2xl font-bold text-blue-600">
                      ${cartTotal.toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={placeOrder}
                    disabled={placingOrder}
                    className="w-full bg-green-500 text-white py-3 rounded hover:bg-green-600 transition cursor-pointer font-semibold text-sm sm:text-base disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {placingOrder ? "Placing order..." : "Checkout"}
                  </button>
                  <button
                    onClick={() => setCartOpen(false)}
                    className="w-full bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400 transition cursor-pointer text-sm sm:text-base"
                  >
                    Continue Shopping
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ORDER HISTORY TAB */}
        {activeTab === "orders" && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            {loading ? (
              <div className="text-center text-gray-500 py-8">
                Loading orders...
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No orders yet. Start shopping!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm sm:text-base">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-2 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold">
                        Order ID
                      </th>
                      <th className="px-2 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold">
                        Date
                      </th>
                      <th className="px-2 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold">
                        Items
                      </th>
                      <th className="px-2 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold">
                        Amount
                      </th>
                      <th className="px-2 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold">
                        Status
                      </th>
                      <th className="px-2 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {orders.map((order) => (
                      <tr key={order._id} className="hover:bg-gray-50">
                        <td className="px-2 sm:px-6 py-4 font-semibold text-xs sm:text-sm line-clamp-1">
                          {order.orderId}
                        </td>
                        <td className="px-2 sm:px-6 py-4 text-xs sm:text-sm">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-2 sm:px-6 py-4 text-xs sm:text-sm">
                          {order.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0}
                        </td>
                        <td className="px-2 sm:px-6 py-4 font-semibold text-xs sm:text-sm">
                          ${order.totalAmount.toFixed(2)}
                        </td>
                        <td className="px-2 sm:px-6 py-4">
                          <span
                            className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${
                              order.status === "delivered"
                                ? "bg-green-100 text-green-800"
                                : order.status === "shipped"
                                  ? "bg-blue-100 text-blue-800"
                                  : order.status === "in_transit"
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {ORDER_STATUS_LABELS[order.status] || order.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-2 sm:px-6 py-4">
                          <button
                            onClick={() => reorderOrder(order)}
                            className="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs sm:text-sm font-medium"
                          >
                            Reorder
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TRACKING TAB */}
        {activeTab === "tracking" && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            {loading ? (
              <div className="text-center text-gray-500 py-8">
                Loading tracking info...
              </div>
            ) : tracking.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="text-6xl mb-4">📍</div>
                No active deliveries. Place an order to track it!
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {tracking.map((delivery) => {
                  const destinationLocation = {
                    lat: Number(delivery.customerLocation?.lat),
                    lng: Number(delivery.customerLocation?.lng),
                  };
                  const hasDestinationLocation =
                    Number.isFinite(destinationLocation.lat) &&
                    Number.isFinite(destinationLocation.lng);
                  const liveLocation = delivery.partnerCurrentLocation;
                  const hasLiveLocation =
                    Number.isFinite(Number(liveLocation?.lat)) &&
                    Number.isFinite(Number(liveLocation?.lng));
                  const lastLocationUpdate = liveLocation?.updatedAt
                    ? new Date(liveLocation.updatedAt).toLocaleTimeString()
                    : null;

                  return (
                    <div
                      key={delivery._id}
                      className="border rounded-lg p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-purple-50"
                    >
                      <div className="flex justify-between items-start mb-4 gap-2">
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-bold line-clamp-1">
                            {delivery.orderId}
                          </h3>
                          <p className="text-xs sm:text-sm text-gray-600 line-clamp-1">
                            Driver:{" "}
                            {delivery.partnerId?.name ||
                              delivery.partnerName ||
                              "Assigning partner"}
                          </p>
                        </div>
                        <span
                          className={`px-2 sm:px-4 py-1 rounded-full font-semibold text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
                            delivery.status === "delivered"
                              ? "bg-green-100 text-green-800"
                              : delivery.status === "in_transit"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {ORDER_STATUS_LABELS[delivery.status] || delivery.status.replace(/_/g, " ")}
                        </span>
                      </div>

                      {/* Progress */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span>Progress</span>
                          <span>{getOrderProgress(delivery.status)}%</span>
                        </div>
                        <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-blue-100">
                          <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${getOrderProgress(delivery.status)}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                          {ORDER_STATUS_FLOW.map((step, index) => {
                            const currentIndex = ORDER_STATUS_FLOW.indexOf(delivery.status);
                            const completed = currentIndex >= index;
                            return (
                              <div key={step} className="flex items-center gap-2">
                                <span
                                  className={`w-2.5 h-2.5 rounded-full ${
                                    completed ? "bg-blue-600" : "bg-gray-300"
                                  }`}
                                />
                                <span
                                  className={`text-xs ${
                                    completed ? "text-blue-700 font-medium" : "text-gray-500"
                                  }`}
                                >
                                  {ORDER_STATUS_LABELS[step]}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {hasDestinationLocation && (
                        <div className="mt-5 rounded-xl border border-blue-100 bg-white/80 p-3">
                          <LiveRouteMap
                            startLocation={hasLiveLocation ? liveLocation : null}
                            endLocation={destinationLocation}
                            currentLocation={hasLiveLocation ? liveLocation : null}
                            heightClassName="h-56"
                          />
                          <p className="mt-2 text-xs text-gray-600">
                            {hasLiveLocation
                              ? `Partner live location updated at ${lastLocationUpdate}`
                              : "Live route will appear once partner starts sharing location."}
                          </p>
                        </div>
                      )}

                      {!hasDestinationLocation && (
                        <p className="mt-5 text-xs text-gray-600">
                          Map preview unavailable because this order has no location coordinates.
                        </p>
                      )}

                      {/* Delivery Info */}
                      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-4 border-t text-sm sm:text-base">
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm text-gray-600">Delivery Address</p>
                          <p className="font-semibold line-clamp-2">{delivery.deliveryAddress}</p>
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm text-gray-600">Amount</p>
                          <p className="font-semibold">${delivery.totalAmount.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDashboard;
