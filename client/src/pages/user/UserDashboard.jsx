import { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  ArrowUpDown,
  ChevronRight,
  Clock3,
  Copy,
  MapPinned,
  Minus,
  Package,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  Store,
  Trash2,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import DeliveryLocationPicker from "../../components/DeliveryLocationPicker";
import LiveRouteMap from "../../components/LiveRouteMap";
import UserBottomNav from "../../components/UserBottomNav";
import { AppContext } from "../../context/appContext";

const DEFAULT_CATEGORIES = ["All", "Bakery", "Pharmacy", "Cafe"];

const ORDER_STATUS_LABELS = {
  pending: "Ordered",
  confirmed: "Preparing",
  shipped: "Shipped",
  in_transit: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const TRACKING_STEPS = [
  { id: "ordered", label: "Ordered" },
  { id: "shipped", label: "Shipped" },
  { id: "in_transit", label: "In Transit" },
];

const BASE_DELIVERY_FEE = Number(import.meta.env.VITE_BASE_DELIVERY_FEE || 2.49);
const DELIVERY_FEE_PER_KM = Number(import.meta.env.VITE_DELIVERY_FEE_PER_KM || 0.75);
const PLATFORM_FEE_RATE = Number(import.meta.env.VITE_PLATFORM_FEE_RATE || 0.05);

const roundCurrency = (value) => Math.round((Number(value) || 0) * 100) / 100;

const calculateDistanceKm = (startPoint, endPoint) => {
  if (!startPoint || !endPoint) return 0;

  const earthRadiusKm = 6371;
  const radians = Math.PI / 180;
  const latitudeDelta = (endPoint.lat - startPoint.lat) * radians;
  const longitudeDelta = (endPoint.lng - startPoint.lng) * radians;
  const startLatitudeInRadians = startPoint.lat * radians;
  const endLatitudeInRadians = endPoint.lat * radians;
  const haversineComponent =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitudeInRadians) *
      Math.cos(endLatitudeInRadians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversineComponent), Math.sqrt(1 - haversineComponent));
};

const resolveStoreLocation = (store) => {
  const coordinates = Array.isArray(store?.location?.coordinates) ? store.location.coordinates : [];
  if (coordinates.length !== 2) return null;

  return {
    lat: Number(coordinates[1]),
    lng: Number(coordinates[0]),
  };
};

const estimateDeliveryFee = (distanceKm, hasDistanceInputs) =>
  roundCurrency(BASE_DELIVERY_FEE + (hasDistanceInputs ? Math.max(0, distanceKm) * DELIVERY_FEE_PER_KM : 0));

const buildReviewKey = (orderId, targetId, targetType) =>
  `${String(orderId || "")}:${String(targetId || "")}:${String(targetType || "")}`;

const resolveOrderSubtotal = (order) => {
  const explicitSubtotal = Number(order?.baseSubtotal);
  if (Number.isFinite(explicitSubtotal) && explicitSubtotal > 0) {
    return explicitSubtotal;
  }

  const total = Number(order?.totalAmount || 0);
  const deliveryFee = Number(order?.deliveryFee || 0);
  const platformFee = Number(order?.platformFee || 0);
  return roundCurrency(Math.max(0, total - deliveryFee - platformFee));
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

const getTrackingStepIndex = (status) => {
  if (status === "in_transit") return 2;
  if (status === "shipped") return 1;
  return 0;
};

const toLocation = (location) => {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
};

const hashString = (value = "") =>
  Array.from(String(value)).reduce((acc, char) => {
    const next = (acc << 5) - acc + char.charCodeAt(0);
    return next | 0;
  }, 0);

const getStorePresentation = (store) => {
  const hashSeed = Math.abs(hashString(`${store?._id || "store"}-${store?.storeName || "unknown"}`));
  const rating = Number((3.8 + (hashSeed % 13) * 0.1).toFixed(1));
  const distanceKm = Number((0.7 + ((hashSeed >> 2) % 90) * 0.1).toFixed(1));
  const imageSeed = encodeURIComponent(String(store?._id || store?.storeName || "store"));

  return {
    rating,
    distanceKm,
    imageUrl: `https://picsum.photos/seed/${imageSeed}/900/600`,
  };
};

const resolveStoreIdFromItem = (item) => {
  if (!item?.storeId) return "";

  if (typeof item.storeId === "string") {
    return item.storeId;
  }

  return item.storeId?._id ? String(item.storeId._id) : "";
};

const resolveStoreNameFromItem = (item) => {
  if (!item?.storeId) return "Store";

  if (typeof item.storeId === "object") {
    return item.storeId?.storeName || "Store";
  }

  return "Store";
};

const upsertByOrderId = (orders, order) => {
  const existingOrder = orders.find((currentOrder) => currentOrder._id === order._id);
  const mergedOrder = existingOrder ? { ...existingOrder, ...order } : order;

  if (!order?.deliveryOTP && existingOrder?.deliveryOTP) {
    mergedOrder.deliveryOTP = existingOrder.deliveryOTP;
  }

  const next = orders.filter((existingOrder) => existingOrder._id !== order._id);
  return [mergedOrder, ...next];
};

const mergePartnerLocation = (orders, orderId, partnerCurrentLocation) =>
  orders.map((existingOrder) =>
    existingOrder._id === orderId
      ? {
          ...existingOrder,
          partnerCurrentLocation,
        }
      : existingOrder,
  );

const StoreCardSkeleton = () => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="h-44 animate-pulse bg-slate-200" />
    <div className="space-y-3 p-4">
      <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
      <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
      <div className="h-8 w-full animate-pulse rounded-xl bg-slate-200" />
    </div>
  </div>
);

const UserDashboard = () => {
  const { user, token } = useContext(AppContext);

  const [activeTab, setActiveTab] = useState("home");
  const [orders, setOrders] = useState([]);
  const [tracking, setTracking] = useState([]);
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  const [storesLoading, setStoresLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchItems, setSearchItems] = useState([]);

  const [sortBy, setSortBy] = useState("fastest");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [matchingStoreIds, setMatchingStoreIds] = useState(null);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [selectedStoreItems, setSelectedStoreItems] = useState([]);
  const [selectedStoreItemsLoading, setSelectedStoreItemsLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState(() => ({
    deliveryAddress: String(localStorage.getItem("userDeliveryAddress") || "").trim(),
    clientPhone: "",
  }));
  const [reviews, setReviews] = useState([]);
  const [reviewModalState, setReviewModalState] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewPromptPaused, setReviewPromptPaused] = useState(false);
  const [dismissedReviewKeys, setDismissedReviewKeys] = useState(() => new Set());
  const [dismissedReviewOrderIds, setDismissedReviewOrderIds] = useState(() => new Set());
  const [deliveryLocation, setDeliveryLocation] = useState(() => {
    const savedLocation = localStorage.getItem("userDeliveryLocation");
    if (!savedLocation) return null;

    try {
      const parsedLocation = JSON.parse(savedLocation);
      const lat = Number(parsedLocation?.lat);
      const lng = Number(parsedLocation?.lng);

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    } catch {
      return null;
    }

    return null;
  });
  const [showLocationPicker, setShowLocationPicker] = useState(() => {
    const savedLocation = localStorage.getItem("userDeliveryLocation");
    return !savedLocation;
  });

  useEffect(() => {
    const debounceTimeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 250);

    return () => clearTimeout(debounceTimeoutId);
  }, [searchQuery]);

  useEffect(() => {
    const savedCart = localStorage.getItem("userCart");
    if (!savedCart) return;

    try {
      const parsedCart = JSON.parse(savedCart);
      if (Array.isArray(parsedCart)) {
        setCart(parsedCart);
      }
    } catch {
      setCart([]);
    }
  }, []);

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

  useEffect(() => {
    const normalizedAddress = String(checkoutForm.deliveryAddress || "").trim();
    if (normalizedAddress) {
      localStorage.setItem("userDeliveryAddress", normalizedAddress);
      return;
    }
    localStorage.removeItem("userDeliveryAddress");
  }, [checkoutForm.deliveryAddress]);

  useEffect(() => {
    if (!deliveryLocation) {
      setShowLocationPicker(true);
    }
  }, [deliveryLocation]);

  useEffect(() => {
    setCheckoutForm((previousForm) => ({
      ...previousForm,
      clientPhone: previousForm.clientPhone || user?.phone || "",
    }));
  }, [user?.phone]);

  useEffect(() => {
    let isMounted = true;

    const fetchStoresAndCategories = async () => {
      setStoresLoading(true);

      try {
        const [storesResult, categoriesResult] = await Promise.allSettled([
          axios.get("/stores/all"),
          axios.get("/items/categories/all"),
        ]);

        if (!isMounted) return;

        if (storesResult.status === "fulfilled") {
          setStores(storesResult.value.data?.stores || []);
        } else {
          setStores([]);
          toast.error("Unable to load stores right now");
        }

        if (categoriesResult.status === "fulfilled") {
          const apiCategories = Array.isArray(categoriesResult.value.data?.categories)
            ? categoriesResult.value.data.categories
            : [];

          const mergedCategories = [
            ...DEFAULT_CATEGORIES,
            ...apiCategories.filter((category) => !DEFAULT_CATEGORIES.includes(category)),
          ];

          setCategories(mergedCategories);
        } else {
          setCategories(DEFAULT_CATEGORIES);
        }
      } finally {
        if (isMounted) {
          setStoresLoading(false);
        }
      }
    };

    fetchStoresAndCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setOrders([]);
      setTracking([]);
      setReviews([]);
      setOrdersLoading(false);
      return;
    }

    let isMounted = true;

    const fetchOrders = async () => {
      setOrdersLoading(true);

      try {
        const [ordersResult, trackingResult, reviewsResult] = await Promise.allSettled([
          axios.get(`/orders/user/${user.id}`),
          axios.get(`/orders/tracking/${user.id}`),
          axios.get(`/reviews/user/${user.id}`),
        ]);

        if (!isMounted) return;

        if (ordersResult.status === "fulfilled") {
          setOrders(ordersResult.value.data?.orders || []);
        } else {
          setOrders([]);
          toast.error("Unable to load your orders right now");
        }

        if (trackingResult.status === "fulfilled") {
          setTracking(trackingResult.value.data?.tracking || []);
        } else {
          setTracking([]);
        }

        if (reviewsResult.status === "fulfilled") {
          setReviews(reviewsResult.value.data?.reviews || []);
        } else {
          setReviews([]);
        }
      } finally {
        if (isMounted) {
          setOrdersLoading(false);
        }
      }
    };

    fetchOrders();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const existingDeviceToken = String(localStorage.getItem("fcmDeviceToken") || "").trim();
    if (!existingDeviceToken) return;

    axios
      .post(`/users/${user.id}/push-token`, {
        deviceToken: existingDeviceToken,
        platform: "web",
      })
      .catch(() => {
        // Push token registration is best-effort.
      });
  }, [user?.id]);

  useEffect(() => {
    if (!token || !user?.id) return;

    let socket;
    let closed = false;

    const connectSocket = async () => {
      try {
        const ioClient = await loadSocketClient();
        if (closed || typeof ioClient !== "function") return;

        socket = ioClient(resolveSocketServerUrl(), {
          transports: ["websocket"],
          auth: { token },
        });

        socket.on("connect", () => {
          socket.emit("join:user", user.id);
        });

        socket.on("order:user:tracking", ({ order }) => {
          if (!order?._id) return;

          setOrders((previousOrders) => upsertByOrderId(previousOrders, order));

          if (order.status === "delivered" || order.status === "cancelled") {
            setTracking((previousTracking) =>
              previousTracking.filter((existingOrder) => existingOrder._id !== order._id),
            );
            return;
          }

          setTracking((previousTracking) => upsertByOrderId(previousTracking, order));
        });

        socket.on("order:user:partner-location", ({ orderId, partnerCurrentLocation }) => {
          if (!orderId || !partnerCurrentLocation) return;

          setOrders((previousOrders) =>
            mergePartnerLocation(previousOrders, orderId, partnerCurrentLocation),
          );
          setTracking((previousTracking) =>
            mergePartnerLocation(previousTracking, orderId, partnerCurrentLocation),
          );
        });

        socket.on("order:user:delivery-otp", ({ orderId, deliveryOTP }) => {
          if (!orderId || !deliveryOTP) return;

          const applyOtpToOrder = (order) =>
            String(order?._id) === String(orderId)
              ? {
                  ...order,
                  deliveryOTP: String(deliveryOTP),
                }
              : order;

          setOrders((previousOrders) => previousOrders.map(applyOtpToOrder));
          setTracking((previousTracking) => previousTracking.map(applyOtpToOrder));
        });
      } catch {
        // Realtime updates are optional; dashboard still works with polling state.
      }
    };

    connectSocket();

    return () => {
      closed = true;
      if (socket) {
        socket.disconnect();
      }
    };
  }, [token, user?.id]);

  useEffect(() => {
    if (reviewPromptPaused || reviewModalState || !orders.length) return;

    const reviewedKeys = new Set(
      (reviews || []).map((review) =>
        buildReviewKey(review.orderId, review.targetId, review.targetType),
      ),
    );

    for (const order of orders) {
      if (order.status !== "delivered") continue;
      if (dismissedReviewOrderIds.has(String(order._id))) continue;

      const storeId = typeof order.storeId === "object" ? order.storeId?._id : order.storeId;
      const partnerId = typeof order.partnerId === "object" ? order.partnerId?._id : order.partnerId;

      const reviewTargets = [
        {
          targetType: "store",
          targetId: storeId,
          targetName: order.storeId?.storeName || "Store",
        },
      ];

      if (partnerId) {
        reviewTargets.push({
          targetType: "partner",
          targetId: partnerId,
          targetName: order.partnerId?.name || "Partner",
        });
      }

      for (const target of reviewTargets) {
        const reviewKey = buildReviewKey(order._id, target.targetId, target.targetType);
        if (!target.targetId || reviewedKeys.has(reviewKey) || dismissedReviewKeys.has(reviewKey)) {
          continue;
        }

        setReviewRating(5);
        setReviewComment("");
        setReviewModalState({
          orderId: order._id,
          orderLabel: order.orderId,
          targetId: String(target.targetId),
          targetType: target.targetType,
          targetName: target.targetName,
        });
        return;
      }
    }
  }, [dismissedReviewKeys, dismissedReviewOrderIds, orders, reviewModalState, reviewPromptPaused, reviews]);

  const shouldFetchDiscoveryMatches =
    selectedCategory !== "All" || debouncedSearchQuery.length > 0;

  useEffect(() => {
    let isMounted = true;

    if (!shouldFetchDiscoveryMatches) {
      setMatchingStoreIds(null);
      setSearchItems([]);
      setDiscoveryLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const fetchStoreMatches = async () => {
      setDiscoveryLoading(true);

      try {
        const query = new URLSearchParams({
          query: debouncedSearchQuery,
          category: selectedCategory,
        });

        const { data } = await axios.get(`/items/search/global?${query}`);
        if (!isMounted) return;

        const matchedItems = data?.items || [];
        const ids = new Set(
          matchedItems
            .map((item) =>
              typeof item?.storeId === "string" ? item.storeId : item?.storeId?._id,
            )
            .filter(Boolean)
            .map((id) => String(id)),
        );

        setSearchItems(matchedItems);
        setMatchingStoreIds(ids);
      } catch {
        if (isMounted) {
          setSearchItems([]);
          setMatchingStoreIds(new Set());
        }
      } finally {
        if (isMounted) {
          setDiscoveryLoading(false);
        }
      }
    };

    fetchStoreMatches();

    return () => {
      isMounted = false;
    };
  }, [debouncedSearchQuery, selectedCategory, shouldFetchDiscoveryMatches]);

  const storesWithPresentation = useMemo(
    () => stores.map((store) => ({ ...store, ...getStorePresentation(store) })),
    [stores],
  );
  const storeNameById = useMemo(
    () => new Map(stores.map((store) => [String(store._id), store.storeName || "Store"])),
    [stores],
  );

  const visibleStores = useMemo(() => {
    const normalizedSearch = debouncedSearchQuery.toLowerCase();

    const filtered = storesWithPresentation.filter((store) => {
      const textMatch =
        !normalizedSearch ||
        [store.storeName, store.city, store.address]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedSearch));

      if (!shouldFetchDiscoveryMatches) {
        return textMatch;
      }

      const itemMatch =
        matchingStoreIds instanceof Set && matchingStoreIds.has(String(store._id));

      if (selectedCategory !== "All") {
        return itemMatch;
      }

      return textMatch || itemMatch;
    });

    filtered.sort((storeA, storeB) => {
      if (sortBy === "top_rated") {
        if (storeB.rating !== storeA.rating) {
          return storeB.rating - storeA.rating;
        }
        return storeA.distanceKm - storeB.distanceKm;
      }

      if (storeA.distanceKm !== storeB.distanceKm) {
        return storeA.distanceKm - storeB.distanceKm;
      }
      return storeB.rating - storeA.rating;
    });

    return filtered;
  }, [
    debouncedSearchQuery,
    matchingStoreIds,
    selectedCategory,
    shouldFetchDiscoveryMatches,
    sortBy,
    storesWithPresentation,
  ]);

  const visibleSearchItems = useMemo(() => {
    const normalizedSearch = debouncedSearchQuery.toLowerCase();

    return searchItems
      .filter((item) => {
        const stock = Number(item?.stock || 0);
        if (stock <= 0) return false;

        const categoryMatch =
          selectedCategory === "All" ||
          String(item?.category || "").toLowerCase() === selectedCategory.toLowerCase();

        const textMatch =
          !normalizedSearch ||
          [item?.itemName, item?.description, item?.category]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(normalizedSearch));

        return categoryMatch && textMatch;
      })
      .slice(0, 24);
  }, [debouncedSearchQuery, searchItems, selectedCategory]);

  const selectedStore = useMemo(
    () => storesWithPresentation.find((store) => String(store._id) === String(selectedStoreId)) || null,
    [selectedStoreId, storesWithPresentation],
  );

  const visibleSelectedStoreItems = useMemo(() => {
    const normalizedSearch = debouncedSearchQuery.toLowerCase();

    return selectedStoreItems
      .filter((item) => {
        const stock = Number(item?.stock || 0);
        if (stock <= 0) return false;

        const categoryMatch =
          selectedCategory === "All" ||
          String(item?.category || "").toLowerCase() === selectedCategory.toLowerCase();

        const textMatch =
          !normalizedSearch ||
          [item?.itemName, item?.description, item?.category]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(normalizedSearch));

        return categoryMatch && textMatch;
      })
      .slice(0, 24);
  }, [debouncedSearchQuery, selectedCategory, selectedStoreItems]);

  const cartQuantityByItemId = useMemo(
    () =>
      cart.reduce((accumulator, cartItem) => {
        accumulator[String(cartItem._id)] = Number(cartItem.quantity || 0);
        return accumulator;
      }, {}),
    [cart],
  );

  const cartItemsCount = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [cart],
  );

  const cartTotalAmount = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0),
    [cart],
  );

  const cartPricingBreakdown = useMemo(() => {
    const subtotal = roundCurrency(cartTotalAmount);
    const platformFee = roundCurrency(subtotal * PLATFORM_FEE_RATE);

    const groupedByStore = cart.reduce((accumulator, cartItem) => {
      const storeId = String(cartItem.storeId || "");
      if (!storeId) return accumulator;
      if (!accumulator[storeId]) {
        accumulator[storeId] = 0;
      }
      accumulator[storeId] += Number(cartItem.price || 0) * Number(cartItem.quantity || 0);
      return accumulator;
    }, {});

    const deliveryFee = roundCurrency(
      Object.keys(groupedByStore).reduce((sum, storeId) => {
        const store = stores.find((entry) => String(entry._id) === String(storeId));
        const storeLocation = resolveStoreLocation(store);
        const hasDistanceInputs = Boolean(storeLocation && deliveryLocation);
        const distanceKm = hasDistanceInputs ? calculateDistanceKm(storeLocation, deliveryLocation) : 0;
        return sum + estimateDeliveryFee(distanceKm, hasDistanceInputs);
      }, 0),
    );

    const total = roundCurrency(subtotal + platformFee + deliveryFee);

    return {
      subtotal,
      platformFee,
      deliveryFee,
      total,
    };
  }, [cart, cartTotalAmount, deliveryLocation, stores]);

  const hasSavedDeliveryLocation =
    Number.isFinite(Number(deliveryLocation?.lat)) &&
    Number.isFinite(Number(deliveryLocation?.lng));

  const addItemToCart = (item, fallbackStoreId = "", fallbackStoreName = "Store") => {
    const normalizedStoreId = resolveStoreIdFromItem(item) || String(fallbackStoreId || "");
    if (!normalizedStoreId) {
      toast.error("Unable to identify item store");
      return;
    }

    const normalizedItemId = String(item?._id || "");
    if (!normalizedItemId) {
      toast.error("Unable to add this item");
      return;
    }

    const storeName = resolveStoreNameFromItem(item) || fallbackStoreName || "Store";
    const normalizedCartItem = {
      _id: normalizedItemId,
      itemName: item.itemName || "Item",
      price: Number(item.price || 0),
      quantity: 1,
      storeId: normalizedStoreId,
      storeName,
      image: item.image || "",
      category: item.category || "",
    };

    setCart((previousCart) => {
      const existingItem = previousCart.find((cartItem) => String(cartItem._id) === normalizedItemId);
      if (!existingItem) {
        return [...previousCart, normalizedCartItem];
      }

      return previousCart.map((cartItem) =>
        String(cartItem._id) === normalizedItemId
          ? { ...cartItem, quantity: Number(cartItem.quantity || 0) + 1 }
          : cartItem,
      );
    });
    toast.success(`${item.itemName || "Item"} added to cart`);
  };

  const updateCartQuantity = (itemId, quantity) => {
    const normalizedItemId = String(itemId || "");

    if (quantity <= 0) {
      setCart((previousCart) =>
        previousCart.filter((cartItem) => String(cartItem._id) !== normalizedItemId),
      );
      return;
    }

    setCart((previousCart) =>
      previousCart.map((cartItem) =>
        String(cartItem._id) === normalizedItemId
          ? { ...cartItem, quantity: Number(quantity) }
          : cartItem,
      ),
    );
  };

  const removeFromCart = (itemId) => {
    const normalizedItemId = String(itemId || "");
    setCart((previousCart) =>
      previousCart.filter((cartItem) => String(cartItem._id) !== normalizedItemId),
    );
  };

  const placeOrder = async () => {
    if (!user?.id) {
      toast.error("Please log in to place an order");
      return;
    }

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

    const groupedItems = cart.reduce((accumulator, cartItem) => {
      const storeId = String(cartItem.storeId || "");
      if (!storeId) return accumulator;

      if (!accumulator[storeId]) {
        accumulator[storeId] = [];
      }
      accumulator[storeId].push(cartItem);
      return accumulator;
    }, {});

    const storeIds = Object.keys(groupedItems);
    if (!storeIds.length) {
      toast.error("Unable to identify stores for checkout");
      return;
    }

    setPlacingOrder(true);

    try {
      const requests = storeIds.map((storeId) => {
        const itemsForStore = groupedItems[storeId];
        const payloadItems = itemsForStore.map((cartItem) => ({
          itemId: cartItem._id,
          itemName: cartItem.itemName,
          quantity: Number(cartItem.quantity || 0),
          price: Number(cartItem.price || 0),
          subtotal: Number(cartItem.price || 0) * Number(cartItem.quantity || 0),
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
                lat: Number(deliveryLocation.lat),
                lng: Number(deliveryLocation.lng),
                label: checkoutForm.deliveryAddress.trim(),
              }
            : undefined,
          clientName: user?.name || "Customer",
          clientPhone: checkoutForm.clientPhone.trim(),
        });
      });

      await Promise.all(requests);

      const [ordersResult, trackingResult] = await Promise.allSettled([
        axios.get(`/orders/user/${user.id}`),
        axios.get(`/orders/tracking/${user.id}`),
      ]);

      if (ordersResult.status === "fulfilled") {
        setOrders(ordersResult.value.data?.orders || []);
      }
      if (trackingResult.status === "fulfilled") {
        setTracking(trackingResult.value.data?.tracking || []);
      }

      setCart([]);
      setCartOpen(false);
      setShowLocationPicker(false);
      setActiveTab("home");
      toast.success("Order placed successfully");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to place order");
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleViewStore = async (storeId) => {
    if (!storeId) return;

    setSelectedStoreId(String(storeId));
    setSelectedStoreItemsLoading(true);

    try {
      const { data } = await axios.get(`/items/${storeId}`);
      setSelectedStoreItems(data?.items || []);
    } catch {
      setSelectedStoreItems([]);
      toast.error("Unable to load store products");
    } finally {
      setSelectedStoreItemsLoading(false);
    }
  };

  const submitReview = async () => {
    if (!reviewModalState || !user?.id) return;

    try {
      setSubmittingReview(true);
      const { data } = await axios.post("/reviews", {
        orderId: reviewModalState.orderId,
        clientId: user.id,
        targetId: reviewModalState.targetId,
        targetType: reviewModalState.targetType,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });

      if (data?.review) {
        setReviews((previousReviews) => [data.review, ...previousReviews]);
      }

      setDismissedReviewOrderIds((previousOrderIds) =>
        new Set([...previousOrderIds, String(reviewModalState.orderId)]),
      );
      setReviewPromptPaused(true);
      setReviewModalState(null);
      setReviewComment("");
      setReviewRating(5);
      toast.success("Thanks for your feedback");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const dismissReviewModal = () => {
    if (reviewModalState) {
      const reviewKey = buildReviewKey(
        reviewModalState.orderId,
        reviewModalState.targetId,
        reviewModalState.targetType,
      );
      setDismissedReviewKeys((previousKeys) => new Set([...previousKeys, reviewKey]));
      setDismissedReviewOrderIds((previousOrderIds) =>
        new Set([...previousOrderIds, String(reviewModalState.orderId)]),
      );
    }

    setReviewPromptPaused(true);
    setReviewModalState(null);
    setReviewComment("");
    setReviewRating(5);
  };

  const activeOrder = useMemo(() => {
    const sourceOrders = tracking.length ? tracking : orders;

    return (
      [...sourceOrders]
        .sort(
          (orderA, orderB) =>
            new Date(orderB.updatedAt || orderB.createdAt).getTime() -
            new Date(orderA.updatedAt || orderA.createdAt).getTime(),
        )
        .find(
          (order) => order.status !== "delivered" && order.status !== "cancelled",
        ) || null
    );
  }, [orders, tracking]);

  const activeOrderStepIndex = getTrackingStepIndex(activeOrder?.status);
  const activeOrderProgress = (activeOrderStepIndex / (TRACKING_STEPS.length - 1)) * 100;

  const activeOrderPartnerPhone =
    activeOrder?.partnerPhone || activeOrder?.partnerId?.phone || "";
  const activeOrderOtp = String(activeOrder?.deliveryOTP || "").trim();

  const destinationLocation = toLocation(activeOrder?.customerLocation);
  const liveLocation = toLocation(activeOrder?.partnerCurrentLocation);
  const startLocation = liveLocation || destinationLocation;

  const activeOrderEta = activeOrder?.estimatedDelivery
    ? new Date(activeOrder.estimatedDelivery).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Updating ETA";

  const firstName = user?.name?.split(" ")?.[0] || "User";

  return (
    <div
      className="min-h-screen bg-slate-50 pb-24 text-slate-900"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        <header className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:mb-6 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
            Delivery Dashboard
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Track active deliveries, discover nearby stores, and manage your orders.
          </p>
        </header>

        {activeTab === "home" && (
          <div className="space-y-6">
            <section className="sticky top-0 z-30 -mx-4 border-y border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4 sm:shadow-sm">
              <div className="flex items-center gap-2 sm:gap-3">
                <label className="relative flex-1">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search stores, items, or neighborhoods"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setShowFilterModal(true)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <SlidersHorizontal size={16} />
                  <span className="hidden sm:inline">Filter</span>
                </button>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Active Order</h2>
                {activeOrder && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    {ORDER_STATUS_LABELS[activeOrder.status] || "In Progress"}
                  </span>
                )}
              </div>

              {ordersLoading ? (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
                  <div className="h-60 animate-pulse rounded-xl bg-slate-200" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-12 animate-pulse rounded-xl bg-slate-200" />
                    <div className="h-12 animate-pulse rounded-xl bg-slate-200" />
                  </div>
                </div>
              ) : activeOrder ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="space-y-4 p-4 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Order {activeOrder.orderId}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {activeOrder.items?.length || 0} item(s) • ₹{Number(
                            activeOrder.totalAmount || 0,
                          ).toFixed(2)}
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        <Truck size={14} />
                        {ORDER_STATUS_LABELS[activeOrder.status] || "In Progress"}
                      </div>
                    </div>

                    <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 sm:grid-cols-4">
                      <div className="flex items-center justify-between sm:block">
                        <span className="text-slate-500">Subtotal</span>
                        <p className="font-semibold text-slate-900">
                          ₹{resolveOrderSubtotal(activeOrder).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between sm:block">
                        <span className="text-slate-500">Delivery Fee</span>
                        <p className="font-semibold text-slate-900">
                          ₹{Number(activeOrder.deliveryFee || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between sm:block">
                        <span className="text-slate-500">Platform Fee</span>
                        <p className="font-semibold text-slate-900">
                          ₹{Number(activeOrder.platformFee || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between sm:block">
                        <span className="text-slate-500">Total</span>
                        <p className="font-semibold text-slate-900">
                          ₹{Number(activeOrder.totalAmount || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="relative">
                      <div className="absolute left-0 right-0 top-3 h-1 rounded-full bg-slate-200" />
                      <div
                        className="absolute left-0 top-3 h-1 rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${activeOrderProgress}%` }}
                      />
                      <div className="relative flex justify-between">
                        {TRACKING_STEPS.map((step, index) => {
                          const isStepComplete = index <= activeOrderStepIndex;

                          return (
                            <div
                              key={step.id}
                              className="flex w-[30%] flex-col items-center gap-2 text-center"
                            >
                              <div
                                className={`h-6 w-6 rounded-full border-2 ${
                                  isStepComplete
                                    ? "border-emerald-500 bg-emerald-500"
                                    : "border-slate-300 bg-white"
                                }`}
                              />
                              <span
                                className={`text-xs font-medium ${
                                  isStepComplete ? "text-emerald-700" : "text-slate-500"
                                }`}
                              >
                                {step.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                        Delivery OTP
                      </p>
                      {activeOrderOtp ? (
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="text-2xl font-bold tracking-[0.22em] text-emerald-900">
                            {activeOrderOtp}
                          </p>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(activeOrderOtp);
                                toast.success("Delivery OTP copied");
                              } catch {
                                toast.error("Unable to copy OTP");
                              }
                            }}
                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          >
                            <Copy size={14} />
                            Copy OTP
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm font-medium text-emerald-700">
                          OTP will appear here once a partner is assigned.
                        </p>
                      )}
                      <p className="mt-2 text-xs text-emerald-700/90">
                        Share this OTP with the delivery partner at handoff.
                      </p>
                    </div>

                    {destinationLocation ? (
                      <LiveRouteMap
                        startLocation={startLocation}
                        currentLocation={liveLocation}
                        endLocation={destinationLocation}
                        heightClassName="h-64"
                        currentMarkerStyle="bike"
                      />
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                        Route preview unavailable for this order because customer coordinates are missing.
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      {activeOrderPartnerPhone ? (
                        <a
                          href={`tel:${activeOrderPartnerPhone}`}
                          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
                        >
                          <Phone size={16} />
                          Contact Partner
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 text-sm font-semibold text-slate-500"
                        >
                          <Phone size={16} />
                          Contact Partner
                        </button>
                      )}

                      <div className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700">
                        <Clock3 size={16} className="text-emerald-600" />
                        ETA: {activeOrderEta}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
                  <Package size={26} className="mx-auto text-slate-400" />
                  <h3 className="mt-3 text-base font-semibold text-slate-900">No active order</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    You have no deliveries in progress. Browse stores below to place your next order.
                  </p>
                </div>
              )}
            </section>

            {shouldFetchDiscoveryMatches && (
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Product Results</h2>
                  <p className="text-xs font-medium text-slate-500 sm:text-sm">
                    {visibleSearchItems.length} product{visibleSearchItems.length === 1 ? "" : "s"}
                  </p>
                </div>

                {discoveryLoading ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <StoreCardSkeleton key={`search-skeleton-${index}`} />
                    ))}
                  </div>
                ) : visibleSearchItems.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleSearchItems.map((item) => {
                      const itemStoreId = resolveStoreIdFromItem(item);
                      const itemStoreName =
                        typeof item.storeId === "object"
                          ? item.storeId?.storeName || "Store"
                          : storeNameById.get(String(itemStoreId)) || "Store";
                      const itemImage =
                        item.image ||
                        `https://picsum.photos/seed/product-${encodeURIComponent(String(item._id || item.itemName || "item"))}/900/600`;

                      return (
                        <article
                          key={item._id}
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                        >
                          <img
                            src={itemImage}
                            alt={item.itemName}
                            className="h-40 w-full object-cover"
                            loading="lazy"
                          />
                          <div className="space-y-2 p-4">
                            <p className="line-clamp-1 text-sm font-semibold text-slate-900">
                              {item.itemName}
                            </p>
                            <p className="line-clamp-1 text-xs text-slate-500">{itemStoreName}</p>
                            <div className="flex items-center justify-between">
                              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                {item.category || "General"}
                              </span>
                              <span className="text-sm font-semibold text-slate-800">
                                ₹{Number(item.price || 0).toFixed(2)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => addItemToCart(item, itemStoreId, itemStoreName)}
                              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700"
                            >
                              <Plus size={14} />
                              Add to Cart
                              {cartQuantityByItemId[String(item._id)] ? (
                                <span className="rounded bg-white/20 px-1.5 py-0.5 text-[11px]">
                                  {cartQuantityByItemId[String(item._id)]}
                                </span>
                              ) : null}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
                    No products matched your search. Try another keyword or category.
                  </div>
                )}
              </section>
            )}

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Discover Stores</h2>
                <p className="text-xs font-medium text-slate-500 sm:text-sm">
                  {visibleStores.length} result{visibleStores.length === 1 ? "" : "s"}
                </p>
              </div>

              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {categories.map((category) => {
                  const isActive = selectedCategory === category;

                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setSelectedCategory(category)}
                      className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                        isActive
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>

              {storesLoading || discoveryLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <StoreCardSkeleton key={`store-skeleton-${index}`} />
                  ))}
                </div>
              ) : visibleStores.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleStores.map((store) => (
                    <article
                      key={store._id}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="relative">
                        <img
                          src={store.imageUrl}
                          alt={`${store.storeName} storefront`}
                          className="h-44 w-full object-cover"
                          loading="lazy"
                        />
                        <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                          {store.distanceKm} km
                        </span>
                      </div>
                      <div className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="line-clamp-1 text-base font-semibold text-slate-900">
                              {store.storeName}
                            </h3>
                            <p className="line-clamp-1 text-xs text-slate-500">
                              {store.city || "City unavailable"}
                            </p>
                          </div>
                          <div className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                            <Star size={13} className="fill-amber-400 text-amber-400" />
                            {store.rating}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleViewStore(store._id)}
                          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          <Store size={15} />
                          View Store
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                  <MapPinned size={26} className="mx-auto text-slate-400" />
                  <h3 className="mt-3 text-base font-semibold text-slate-900">No stores found</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Try another search term or switch categories to discover more stores.
                  </p>
                </div>
              )}
            </section>

            {selectedStore && (
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                      {selectedStore.storeName} Products
                    </h2>
                    <p className="text-xs text-slate-500">
                      {visibleSelectedStoreItems.length} available item
                      {visibleSelectedStoreItems.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStoreId("");
                      setSelectedStoreItems([]);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <X size={14} />
                    Close
                  </button>
                </div>

                {selectedStoreItemsLoading ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <StoreCardSkeleton key={`selected-store-skeleton-${index}`} />
                    ))}
                  </div>
                ) : visibleSelectedStoreItems.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleSelectedStoreItems.map((item) => {
                      const itemImage =
                        item.image ||
                        `https://picsum.photos/seed/store-item-${encodeURIComponent(String(item._id || item.itemName || "item"))}/900/600`;

                      return (
                        <article
                          key={item._id}
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                        >
                          <img
                            src={itemImage}
                            alt={item.itemName}
                            className="h-40 w-full object-cover"
                            loading="lazy"
                          />
                          <div className="space-y-2 p-4">
                            <h3 className="line-clamp-1 text-sm font-semibold text-slate-900">
                              {item.itemName}
                            </h3>
                            <p className="line-clamp-2 text-xs text-slate-500">
                              {item.description || "No description available"}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                {item.category || "General"}
                              </span>
                              <span className="text-sm font-semibold text-emerald-700">
                                ₹{Number(item.price || 0).toFixed(2)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                addItemToCart(item, selectedStore?._id, selectedStore?.storeName)
                              }
                              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700"
                            >
                              <Plus size={14} />
                              Add to Cart
                              {cartQuantityByItemId[String(item._id)] ? (
                                <span className="rounded bg-white/20 px-1.5 py-0.5 text-[11px]">
                                  {cartQuantityByItemId[String(item._id)]}
                                </span>
                              ) : null}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
                    No in-stock products found for this store with current filters.
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {activeTab === "orders" && (
          <section className="space-y-4">
            <header className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">My Orders</h2>
              <p className="mt-1 text-sm text-slate-600">Complete history of your recent deliveries.</p>
            </header>

            {ordersLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`order-skeleton-${index}`}
                    className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-64 animate-pulse rounded bg-slate-200" />
                    <div className="h-10 animate-pulse rounded-xl bg-slate-200" />
                  </div>
                ))}
              </div>
            ) : orders.length > 0 ? (
              <div className="space-y-3">
                {orders.map((order) => (
                  <article
                    key={order._id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{order.orderId}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(order.createdAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          order.status === "delivered"
                            ? "bg-emerald-50 text-emerald-700"
                            : order.status === "cancelled"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {ORDER_STATUS_LABELS[order.status] || "Processing"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Items</p>
                        <p className="mt-1 font-semibold">{order.items?.length || 0}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">ETA</p>
                        <p className="mt-1 font-semibold">
                          {order.estimatedDelivery
                            ? new Date(order.estimatedDelivery).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Not available"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                      <div className="flex items-center justify-between py-1">
                        <span>Subtotal</span>
                        <span className="font-semibold text-slate-900">
                          ₹{resolveOrderSubtotal(order).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span>Delivery Fee</span>
                        <span className="font-semibold text-slate-900">
                          ₹{Number(order.deliveryFee || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span>Platform Fee</span>
                        <span className="font-semibold text-slate-900">
                          ₹{Number(order.platformFee || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-2 text-sm">
                        <span className="font-semibold text-slate-700">Total</span>
                        <span className="font-semibold text-slate-900">
                          ₹{Number(order.totalAmount || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                <Package size={26} className="mx-auto text-slate-400" />
                <h3 className="mt-3 text-base font-semibold text-slate-900">No orders yet</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Once you place an order, it will appear here with status and ETA.
                </p>
              </div>
            )}
          </section>
        )}

        {activeTab === "account" && (
          <section className="space-y-4">
            <header className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Account</h2>
              <p className="mt-1 text-sm text-slate-600">Your profile and delivery activity summary.</p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <UserRound size={18} />
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Profile
                </p>
                <p className="mt-1 text-base font-semibold text-slate-900">{user?.name || "Unknown user"}</p>
                <p className="text-sm text-slate-600">{user?.email || "No email available"}</p>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Package size={18} />
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Total Orders
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{orders.length}</p>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2 lg:col-span-1">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <Truck size={18} />
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Active Deliveries
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{tracking.length}</p>
              </article>
            </div>
          </section>
        )}

        {activeTab === "home" && cartItemsCount > 0 && (
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-700 sm:bottom-24 sm:right-6"
          >
            <ShoppingCart size={16} />
            {cartItemsCount} item{cartItemsCount === 1 ? "" : "s"}
            <span className="rounded bg-white/20 px-2 py-0.5">₹{cartPricingBreakdown.total.toFixed(2)}</span>
          </button>
        )}
      </div>

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-900/45 p-0 sm:items-center sm:justify-center sm:p-4">
          <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:max-h-[85vh] sm:max-w-2xl sm:rounded-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Cart</h3>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
                Your cart is empty.
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {cart.map((cartItem) => (
                    <article
                      key={`${cartItem._id}-${cartItem.storeId}`}
                      className="rounded-xl border border-slate-200 p-3"
                    >
                      <div className="flex gap-3">
                        <img
                          src={
                            cartItem.image ||
                            `https://picsum.photos/seed/cart-${encodeURIComponent(String(cartItem._id))}/300/200`
                          }
                          alt={cartItem.itemName}
                          className="h-14 w-14 rounded-md object-cover"
                          loading="lazy"
                        />
                        <div className="flex-1">
                          <p className="line-clamp-1 text-sm font-semibold text-slate-900">
                            {cartItem.itemName}
                          </p>
                          <p className="line-clamp-1 text-xs text-slate-500">
                            {cartItem.storeName || storeNameById.get(String(cartItem.storeId)) || "Store"}
                          </p>
                          <p className="text-xs font-medium text-emerald-700">
                            ₹{Number(cartItem.price || 0).toFixed(2)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(cartItem._id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-600 transition hover:bg-rose-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateCartQuantity(cartItem._id, Number(cartItem.quantity || 0) - 1)
                          }
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold text-slate-800">
                          {Number(cartItem.quantity || 0)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateCartQuantity(cartItem._id, Number(cartItem.quantity || 0) + 1)
                          }
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Delivery Location
                      </span>
                      {hasSavedDeliveryLocation && !showLocationPicker ? (
                        <button
                          type="button"
                          onClick={() => setShowLocationPicker(true)}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          Change
                        </button>
                      ) : null}
                    </div>

                    {hasSavedDeliveryLocation && !showLocationPicker ? (
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
                        <div>
                          <p className="font-medium text-slate-800">Saved location in use</p>
                          <p>
                            {Number(deliveryLocation.lat).toFixed(5)}, {Number(deliveryLocation.lng).toFixed(5)}
                          </p>
                        </div>
                        <MapPinned size={14} className="text-emerald-600" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <DeliveryLocationPicker
                          value={deliveryLocation}
                          onChange={setDeliveryLocation}
                          onAddressResolved={(resolvedAddress) =>
                            setCheckoutForm((previousForm) => ({
                              ...previousForm,
                              deliveryAddress: resolvedAddress || previousForm.deliveryAddress,
                            }))
                          }
                        />

                        {hasSavedDeliveryLocation ? (
                          <button
                            type="button"
                            onClick={() => setShowLocationPicker(false)}
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Use Saved Location
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Delivery Address
                    </span>
                    <input
                      type="text"
                      value={checkoutForm.deliveryAddress}
                      onChange={(event) =>
                        setCheckoutForm((previousForm) => ({
                          ...previousForm,
                          deliveryAddress: event.target.value,
                        }))
                      }
                      placeholder="Enter full delivery address"
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-400"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Phone Number
                    </span>
                    <input
                      type="tel"
                      value={checkoutForm.clientPhone}
                      onChange={(event) =>
                        setCheckoutForm((previousForm) => ({
                          ...previousForm,
                          clientPhone: event.target.value,
                        }))
                      }
                      placeholder="Enter phone number"
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-400"
                    />
                  </label>

                  <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>Subtotal</span>
                      <span className="font-semibold text-slate-900">
                        ₹{cartPricingBreakdown.subtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Delivery Fee</span>
                      <span className="font-semibold text-slate-900">
                        ₹{cartPricingBreakdown.deliveryFee.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Platform Fee</span>
                      <span className="font-semibold text-slate-900">
                        ₹{cartPricingBreakdown.platformFee.toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-2">
                      <span className="font-semibold text-slate-700">Total</span>
                      <span className="text-base font-semibold text-slate-900">
                        ₹{cartPricingBreakdown.total.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={placeOrder}
                    disabled={placingOrder}
                    className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {placingOrder ? "Placing order..." : "Place Order"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <UserBottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {reviewModalState && (
        <div className="fixed inset-0 z-[60] flex items-end bg-slate-900/50 p-4 sm:items-center sm:justify-center">
          <div className="w-full rounded-2xl bg-white p-4 shadow-2xl sm:max-w-md sm:p-5">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">
                  Rate Delivery
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  Order {reviewModalState.orderLabel}
                </p>
                <p className="text-xs text-slate-600">
                  Share feedback for {reviewModalState.targetType}: {reviewModalState.targetName}
                </p>
              </div>
              <button
                type="button"
                onClick={dismissReviewModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mb-3 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, index) => {
                const ratingValue = index + 1;
                const selected = ratingValue <= reviewRating;

                return (
                  <button
                    key={`review-star-${ratingValue}`}
                    type="button"
                    onClick={() => setReviewRating(ratingValue)}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${
                      selected
                        ? "border-amber-300 bg-amber-50 text-amber-600"
                        : "border-slate-200 bg-white text-slate-400"
                    }`}
                  >
                    <Star size={16} className={selected ? "fill-current" : ""} />
                  </button>
                );
              })}
            </div>

            <textarea
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              placeholder="Tell us about your delivery experience"
              className="h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-emerald-400"
            />

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={dismissReviewModal}
                disabled={submittingReview}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Later
              </button>
              <button
                type="button"
                onClick={submitReview}
                disabled={submittingReview}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-emerald-600 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingReview ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-900/40 p-4 sm:items-center sm:justify-center">
          <div className="w-full rounded-2xl bg-white p-5 shadow-2xl sm:max-w-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-slate-800">
                <ArrowUpDown size={16} />
                <h3 className="text-base font-semibold">Sort Stores</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setSortBy("fastest");
                  setShowFilterModal(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                  sortBy === "fastest"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>Fastest Delivery</span>
                {sortBy === "fastest" && <span className="text-xs font-semibold">Selected</span>}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSortBy("top_rated");
                  setShowFilterModal(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                  sortBy === "top_rated"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>Top Rated</span>
                {sortBy === "top_rated" && <span className="text-xs font-semibold">Selected</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;

