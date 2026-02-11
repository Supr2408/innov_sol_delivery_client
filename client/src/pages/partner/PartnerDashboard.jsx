
import { createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  Navigation,
  Phone,
  Power,
  RefreshCw,
  Route,
  ShieldCheck,
  Timer,
  Truck,
  X,
  Delete,
} from "lucide-react";
import LiveRouteMap from "../../components/LiveRouteMap";
import { AppContext } from "../../context/appContext";

const ORDER_STATUS_LABELS = {
  pending: "Order Received",
  confirmed: "Preparing",
  shipped: "Pickup Ready",
  in_transit: "On Trip",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const TRACKABLE_STATUSES = ["shipped", "in_transit"];
const MOVING_LOCATION_EMIT_INTERVAL_MS = 6000;
const STATIONARY_LOCATION_EMIT_INTERVAL_MS = 10000;
const LOCATION_MOVE_THRESHOLD_METERS = 5;

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

const formatMoney = (value) => `$${Number(value || 0).toFixed(2)}`;

const isSameDate = (dateA, dateB) => {
  if (!dateA || !dateB) return false;
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
};

const calculateDistanceMeters = (pointA, pointB) => {
  if (!pointA || !pointB) return Infinity;

  const latA = Number(pointA.lat);
  const lngA = Number(pointA.lng);
  const latB = Number(pointB.lat);
  const lngB = Number(pointB.lng);

  if (![latA, lngA, latB, lngB].every(Number.isFinite)) {
    return Infinity;
  }

  const earthRadiusMeters = 6371000;
  const radiansFactor = Math.PI / 180;
  const latitudeDelta = (latB - latA) * radiansFactor;
  const longitudeDelta = (lngB - lngA) * radiansFactor;
  const latitudeAInRadians = latA * radiansFactor;
  const latitudeBInRadians = latB * radiansFactor;
  const haversineComponent =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeAInRadians) *
      Math.cos(latitudeBInRadians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversineComponent), Math.sqrt(1 - haversineComponent));
};

const resolvePickupLocation = (order) => {
  const candidates = [
    order?.pickupLocation,
    order?.storeLocation,
    order?.storeId?.location,
    order?.storeId?.coordinates,
  ];

  for (const candidate of candidates) {
    const normalized = toLocation(candidate);
    if (normalized) return normalized;
  }

  return null;
};

const resolveTripTarget = (order) => {
  if (!order) return null;

  const pickupLocation = resolvePickupLocation(order);
  const dropoffLocation = toLocation(order.customerLocation);

  if (order.status === "shipped" && pickupLocation) {
    return {
      phase: "pickup",
      label: "Pickup",
      location: pickupLocation,
    };
  }

  if (dropoffLocation) {
    return {
      phase: "dropoff",
      label: "Drop-off",
      location: dropoffLocation,
    };
  }

  if (pickupLocation) {
    return {
      phase: "pickup",
      label: "Pickup",
      location: pickupLocation,
    };
  }

  return null;
};

const getStatusBadgeClass = (status) => {
  switch (status) {
    case "shipped":
      return "bg-blue-100 text-blue-700";
    case "in_transit":
      return "bg-orange-100 text-orange-700";
    case "delivered":
      return "bg-emerald-100 text-emerald-700";
    case "cancelled":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
};

const isOrderAssignedToPartner = (order, partnerId) => {
  if (!order || !partnerId) return false;
  const orderPartnerId =
    typeof order.partnerId === "string" ? order.partnerId : order.partnerId?._id;
  return String(orderPartnerId || "") === String(partnerId);
};

const MetricCard = ({ Icon, label, value, hint }) => (
  <MotionArticle
    layout
    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.18 }}
  >
    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
      {createElement(Icon, { size: 18 })}
    </div>
    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    <p className="mt-1 text-xs text-slate-500">{hint}</p>
  </MotionArticle>
);

const MotionHeader = motion.header;
const MotionSection = motion.section;
const MotionArticle = motion.article;
const MotionAside = motion.aside;
const MotionDiv = motion.div;

const PartnerDashboard = () => {
  const { user, token, userRole } = useContext(AppContext);
  const partnerId = user?.id || user?._id;

  const [isOnline, setIsOnline] = useState(() => {
    const savedDuty = localStorage.getItem("partnerDutyOnline");
    if (!savedDuty) return true;
    return savedDuty === "true";
  });
  const [availableJobs, setAvailableJobs] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [jobActionOrderId, setJobActionOrderId] = useState("");
  const [verifyActionOrderId, setVerifyActionOrderId] = useState("");

  const [currentLocation, setCurrentLocation] = useState(null);
  const [socketReady, setSocketReady] = useState(false);

  const [newOrderPrompt, setNewOrderPrompt] = useState(null);
  const [newOrderCountdown, setNewOrderCountdown] = useState(0);

  const [otpModalOrder, setOtpModalOrder] = useState(null);
  const [otpValue, setOtpValue] = useState("");

  const [jobOfferedCount, setJobOfferedCount] = useState(0);
  const [jobAcceptedCount, setJobAcceptedCount] = useState(0);

  const socketRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const geoWatchIdRef = useRef(null);
  const locationEmitIntervalRef = useRef(null);
  const latestLocationRef = useRef(null);
  const lastEmittedLocationRef = useRef(null);
  const lastLocationEmitTimestampRef = useRef(0);
  const locationEmitDelayRef = useRef(MOVING_LOCATION_EMIT_INTERVAL_MS);
  const onlineRef = useRef(isOnline);
  const geolocationErrorShownRef = useRef(false);
  const orderAlertAudioContextRef = useRef(null);

  const upsertOrder = useCallback((orders, nextOrder) => {
    const withoutCurrent = orders.filter((order) => String(order._id) !== String(nextOrder._id));
    return [nextOrder, ...withoutCurrent];
  }, []);

  const activeOrder = useMemo(
    () =>
      [...deliveries]
        .sort(
          (orderA, orderB) =>
            new Date(orderB.updatedAt || orderB.createdAt).getTime() -
            new Date(orderA.updatedAt || orderA.createdAt).getTime(),
        )
        .find((order) => TRACKABLE_STATUSES.includes(order.status)) || null,
    [deliveries],
  );

  const activeTripTarget = useMemo(() => resolveTripTarget(activeOrder), [activeOrder]);
  const activeTripDropoffLocation = useMemo(
    () => toLocation(activeOrder?.customerLocation),
    [activeOrder],
  );

  const completedToday = useMemo(() => {
    const now = new Date();

    return deliveries.filter((order) => {
      if (order.status !== "delivered") return false;
      const completionDate = new Date(order.deliveredAt || order.updatedAt || order.createdAt);
      return isSameDate(completionDate, now);
    });
  }, [deliveries]);

  const todaysEarnings = useMemo(
    () =>
      completedToday.reduce((sum, order) => {
        const explicitFee = Number(order.deliveryFee);
        if (Number.isFinite(explicitFee) && explicitFee > 0) {
          return sum + explicitFee;
        }

        return sum + 3.5;
      }, 0),
    [completedToday],
  );

  const acceptanceRate = useMemo(() => {
    if (!jobOfferedCount) return 100;
    return Math.max(0, Math.min(100, (jobAcceptedCount / jobOfferedCount) * 100));
  }, [jobAcceptedCount, jobOfferedCount]);

  const fetchAvailableJobs = useCallback(async () => {
    if (!partnerId) return;

    try {
      setLoadingJobs(true);
      const { data } = await axios.get("/orders/jobs/open");
      setAvailableJobs(data?.jobs || []);
    } catch {
      toast.error("Failed to load new jobs");
    } finally {
      setLoadingJobs(false);
    }
  }, [partnerId]);

  const fetchDeliveries = useCallback(async () => {
    if (!partnerId) return;

    try {
      setLoadingDeliveries(true);
      const { data } = await axios.get(`/orders/partner/${partnerId}`);
      setDeliveries(data?.orders || []);
    } catch {
      toast.error("Failed to load assigned deliveries");
    } finally {
      setLoadingDeliveries(false);
    }
  }, [partnerId]);

  useEffect(() => {
    localStorage.setItem("partnerDutyOnline", String(isOnline));
  }, [isOnline]);

  useEffect(() => {
    latestLocationRef.current = currentLocation;
  }, [currentLocation]);

  useEffect(() => {
    onlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    if (!partnerId) return;
    fetchAvailableJobs();
    fetchDeliveries();
  }, [fetchAvailableJobs, fetchDeliveries, partnerId]);

  const stopLiveLocationStreaming = useCallback(() => {
    if (geoWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = null;
    }

    if (locationEmitIntervalRef.current) {
      clearTimeout(locationEmitIntervalRef.current);
      locationEmitIntervalRef.current = null;
    }

    lastEmittedLocationRef.current = null;
    lastLocationEmitTimestampRef.current = 0;
    locationEmitDelayRef.current = MOVING_LOCATION_EMIT_INTERVAL_MS;
  }, []);

  const playNewOrderAlert = useCallback(async () => {
    if (typeof window === "undefined") return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      const audioContext =
        orderAlertAudioContextRef.current &&
        orderAlertAudioContextRef.current.state !== "closed"
          ? orderAlertAudioContextRef.current
          : new AudioContextClass();

      orderAlertAudioContextRef.current = audioContext;

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, now);
      oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.22);

      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.linearRampToValueAtTime(0.05, now + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(now);
      oscillator.stop(now + 0.25);
    } catch {
      // Audio alerts are best-effort and should not block order updates.
    }
  }, []);

  useEffect(
    () => () => {
      stopLiveLocationStreaming();
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (orderAlertAudioContextRef.current?.state !== "closed") {
        orderAlertAudioContextRef.current?.close();
      }
      orderAlertAudioContextRef.current = null;
    },
    [stopLiveLocationStreaming],
  );

  useEffect(() => {
    if (!token || !partnerId) return;

    let activeSocket;

    const connectSocket = async () => {
      try {
        const ioClient = await loadSocketClient();
        if (typeof ioClient !== "function") return;

        activeSocket = ioClient(resolveSocketServerUrl(), {
          transports: ["websocket"],
          auth: { token },
        });

        socketRef.current = activeSocket;

        activeSocket.on("connect", () => {
          setSocketReady(true);
          activeSocket.emit("join:partner", partnerId);

          if (onlineRef.current) {
            activeSocket.emit("join:partners:pool");
          }

          activeSocket.emit("partner:heartbeat", { partnerId });

          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
          }

          heartbeatIntervalRef.current = setInterval(() => {
            if (activeSocket.connected) {
              activeSocket.emit("partner:heartbeat", { partnerId });
            }
          }, 8000);
        });

        activeSocket.on("disconnect", () => {
          setSocketReady(false);
        });

        activeSocket.on("partner:job:new", (payload) => {
          const incomingOrder = payload?.order;
          if (!incomingOrder?._id) return;

          setJobOfferedCount((previous) => previous + 1);

          if (onlineRef.current && incomingOrder.status === "confirmed" && !incomingOrder.partnerId) {
            setAvailableJobs((previousJobs) => upsertOrder(previousJobs, incomingOrder));
            setNewOrderPrompt({
              order: incomingOrder,
              expiresAt: Date.now() + 30000,
            });
            playNewOrderAlert();
            toast.info(payload?.title || "New order available");
          }
        });

        activeSocket.on("order:partner:updated", ({ order }) => {
          if (!order?._id) return;

          setDeliveries((previousDeliveries) => upsertOrder(previousDeliveries, order));
          setAvailableJobs((previousJobs) =>
            previousJobs.filter((job) => String(job._id) !== String(order._id)),
          );
          setNewOrderPrompt((previousPrompt) => {
            if (!previousPrompt) return previousPrompt;
            if (String(previousPrompt.order?._id) !== String(order._id)) return previousPrompt;
            return null;
          });

          if (order.status === "delivered" || order.status === "cancelled") {
            setNewOrderPrompt(null);
          }
        });

        activeSocket.on("order:partner:location", ({ orderId, partnerCurrentLocation }) => {
          if (!orderId || !partnerCurrentLocation) return;

          setDeliveries((previousDeliveries) =>
            previousDeliveries.map((order) =>
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
        toast.error("Unable to initialize real-time channel");
      }
    };

    connectSocket();

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      if (activeSocket) {
        activeSocket.disconnect();
      }

      socketRef.current = null;
      setSocketReady(false);
    };
  }, [partnerId, playNewOrderAlert, token, upsertOrder]);

  useEffect(() => {
    if (!socketReady || !socketRef.current || !partnerId) return;

    if (isOnline) {
      socketRef.current.emit("join:partners:pool");
      return;
    }

    socketRef.current.emit("leave:partners:pool");
    setNewOrderPrompt(null);
    stopLiveLocationStreaming();
  }, [isOnline, partnerId, socketReady, stopLiveLocationStreaming]);

  useEffect(() => {
    if (!newOrderPrompt) {
      setNewOrderCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const secondsLeft = Math.max(0, Math.ceil((newOrderPrompt.expiresAt - Date.now()) / 1000));
      setNewOrderCountdown(secondsLeft);

      if (secondsLeft <= 0) {
        setNewOrderPrompt(null);
      }
    };

    updateCountdown();
    const intervalId = setInterval(updateCountdown, 1000);

    return () => clearInterval(intervalId);
  }, [newOrderPrompt]);

  useEffect(() => {
    if (!isOnline || !partnerId || !socketReady || !activeOrder) {
      stopLiveLocationStreaming();
      return;
    }

    if (!navigator.geolocation) {
      if (!geolocationErrorShownRef.current) {
        toast.error("Geolocation is not supported in this browser");
        geolocationErrorShownRef.current = true;
      }
      return;
    }

    const destinationLocation = activeTripTarget?.location || null;

    const emitPartnerLocation = (forceEmit = false) => {
      const latestLocation = latestLocationRef.current;
      if (!latestLocation || !socketRef.current) return;

      const movedFromLastEmit = calculateDistanceMeters(lastEmittedLocationRef.current, latestLocation);
      if (!forceEmit && movedFromLastEmit < LOCATION_MOVE_THRESHOLD_METERS) {
        return;
      }

      socketRef.current.emit("partner:location:update", {
        orderId: activeOrder._id,
        partnerId,
        lat: latestLocation.lat,
        lng: latestLocation.lng,
        endLocation: destinationLocation || undefined,
      });

      lastEmittedLocationRef.current = latestLocation;
      lastLocationEmitTimestampRef.current = Date.now();
    };

    const scheduleLocationEmit = () => {
      const nextDelay = locationEmitDelayRef.current || MOVING_LOCATION_EMIT_INTERVAL_MS;

      locationEmitIntervalRef.current = setTimeout(() => {
        const elapsedSinceLastEmit = Date.now() - lastLocationEmitTimestampRef.current;
        const shouldForceEmit = elapsedSinceLastEmit >= STATIONARY_LOCATION_EMIT_INTERVAL_MS;
        emitPartnerLocation(shouldForceEmit);
        scheduleLocationEmit();
      }, nextDelay);
    };

    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        const nextLocation = { lat, lng };
        const movedFromLatest = calculateDistanceMeters(latestLocationRef.current, nextLocation);

        locationEmitDelayRef.current =
          movedFromLatest >= LOCATION_MOVE_THRESHOLD_METERS
            ? MOVING_LOCATION_EMIT_INTERVAL_MS
            : STATIONARY_LOCATION_EMIT_INTERVAL_MS;

        latestLocationRef.current = nextLocation;
        setCurrentLocation(nextLocation);

        if (!lastLocationEmitTimestampRef.current) {
          emitPartnerLocation(true);
        }
      },
      () => {
        if (!geolocationErrorShownRef.current) {
          toast.error("Unable to access your current location");
          geolocationErrorShownRef.current = true;
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000,
      },
    );

    scheduleLocationEmit();

    return () => {
      stopLiveLocationStreaming();
    };
  }, [
    activeOrder,
    activeTripTarget,
    isOnline,
    partnerId,
    socketReady,
    stopLiveLocationStreaming,
  ]);

  const claimJob = useCallback(
    async (orderId) => {
      if (!partnerId || !orderId) return;

      try {
        setJobActionOrderId(orderId);
        await axios.post(`/orders/${orderId}/claim`, { partnerId });
        setJobAcceptedCount((previous) => previous + 1);
        setNewOrderPrompt(null);
        toast.success("Order accepted");

        await Promise.all([fetchAvailableJobs(), fetchDeliveries()]);
      } catch (error) {
        const serverMessage = error?.response?.data?.message || "Unable to accept this order";
        const isAvailabilityConflict =
          error?.response?.status === 409 &&
          (serverMessage.toLowerCase().includes("not available") ||
            serverMessage.toLowerCase().includes("already claimed"));

        if (isAvailabilityConflict) {
          try {
            const [jobsResponse, deliveriesResponse] = await Promise.all([
              axios.get("/orders/jobs/open"),
              axios.get(`/orders/partner/${partnerId}`),
            ]);

            const nextJobs = jobsResponse?.data?.jobs || [];
            const nextDeliveries = deliveriesResponse?.data?.orders || [];

            setAvailableJobs(nextJobs);
            setDeliveries(nextDeliveries);

            const assignedOrder = nextDeliveries.find(
              (order) => String(order._id) === String(orderId),
            );

            if (assignedOrder && isOrderAssignedToPartner(assignedOrder, partnerId)) {
              setNewOrderPrompt(null);
              toast.info("Order is already assigned to you. Opening active trip.");
              return;
            }
          } catch {
            // Ignore recovery fetch failures and fall through to generic toast.
          }
        }

        toast.error(serverMessage);
      } finally {
        setJobActionOrderId("");
      }
    },
    [fetchAvailableJobs, fetchDeliveries, partnerId],
  );

  const startTrip = useCallback(async (orderId) => {
    if (!orderId) return;

    try {
      setJobActionOrderId(orderId);
      await axios.put(`/orders/${orderId}`, { status: "in_transit" });
      toast.success("Trip started");
      await fetchDeliveries();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to start trip");
    } finally {
      setJobActionOrderId("");
    }
  }, [fetchDeliveries]);

  const verifyDeliveryOtp = useCallback(
    async (order, otpCode) => {
      if (!order?._id || !partnerId) return;

      const normalizedOtpCode = String(otpCode || "").trim();
      if (!/^\d{4}$/.test(normalizedOtpCode)) {
        toast.error("Enter a valid 4-digit OTP");
        return;
      }

      try {
        setVerifyActionOrderId(order._id);
        await axios.post(`/orders/${order._id}/verify-complete`, {
          partnerId,
          deliveryOTP: normalizedOtpCode,
        });

        toast.success("Delivery verified and completed");
        setOtpModalOrder(null);
        setOtpValue("");
        await fetchDeliveries();
      } catch (error) {
        toast.error(error?.response?.data?.message || "OTP verification failed");
      } finally {
        setVerifyActionOrderId("");
      }
    },
    [fetchDeliveries, partnerId],
  );

  const openDirections = useCallback((provider = "google") => {
    const destination = activeTripTarget?.location || activeTripDropoffLocation;
    if (!destination) {
      toast.error("Trip coordinates are unavailable for navigation");
      return;
    }

    const lat = destination.lat;
    const lng = destination.lng;
    const url =
      provider === "waze"
        ? `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

    window.open(url, "_blank", "noopener,noreferrer");
  }, [activeTripDropoffLocation, activeTripTarget]);

  const livePartnerLocation = currentLocation || toLocation(activeOrder?.partnerCurrentLocation) || null;
  const activeTripStartLocation =
    livePartnerLocation || resolvePickupLocation(activeOrder) || null;
  const activeTripEndLocation = activeTripTarget?.location || activeTripDropoffLocation || null;

  const assignedDeliveries = useMemo(
    () =>
      deliveries.filter(
        (order) => order.status !== "delivered" && order.status !== "cancelled",
      ),
    [deliveries],
  );

  const otpKeypadKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];
  const canAcceptPrompt =
    Boolean(newOrderPrompt) &&
    isOnline &&
    newOrderPrompt?.order?.status === "confirmed" &&
    !newOrderPrompt?.order?.partnerId;

  if (userRole && userRole !== "partner") {
    return (
      <section className="min-h-screen bg-slate-50 p-4">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-900">Partner access only</p>
          <p className="mt-2 text-sm text-slate-600">Please login with a partner account to access this page.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-slate-50 p-3 pb-24 sm:p-5">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <MotionHeader
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Driver Console</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">Partner Dashboard</h1>
              <p className="mt-2 text-sm text-slate-600">
                Real-time trip controls, navigation, and delivery verification.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsOnline((previousStatus) => !previousStatus)}
              className={`inline-flex h-12 min-w-48 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-sm transition ${
                isOnline ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-800 hover:bg-slate-900"
              }`}
            >
              <Power size={18} />
              {isOnline ? "Go Offline" : "Go Online"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MetricCard
              Icon={CircleDollarSign}
              label="Today's Earnings"
              value={formatMoney(todaysEarnings)}
              hint="Completed jobs today"
            />
            <MetricCard
              Icon={CheckCircle2}
              label="Deliveries Completed"
              value={String(completedToday.length)}
              hint="Completed today"
            />
            <MetricCard
              Icon={Gauge}
              label="Acceptance Rate"
              value={`${acceptanceRate.toFixed(0)}%`}
              hint={`${jobAcceptedCount}/${Math.max(jobOfferedCount, jobAcceptedCount)} accepted`}
            />
          </div>
        </MotionHeader>

        <MotionSection
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.02 }}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Trip View</h2>
            <button
              type="button"
              onClick={() => {
                fetchAvailableJobs();
                fetchDeliveries();
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          {!activeOrder ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <Route size={22} className="mx-auto text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-700">No active trip right now</p>
              <p className="mt-1 text-xs text-slate-500">Accept a new order to start live navigation and tracking.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Order {activeOrder.orderId}</p>
                  <p className="text-xs text-slate-500">
                    Delivery target - {activeOrder.storeId?.storeName || "Store"}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(activeOrder.status)}`}>
                  {ORDER_STATUS_LABELS[activeOrder.status] || activeOrder.status}
                </span>
              </div>

              {!isOnline && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                  You are offline. Trip location streaming is paused until you go online.
                </div>
              )}

              {activeTripEndLocation ? (
                <LiveRouteMap
                  startLocation={activeTripStartLocation}
                  currentLocation={livePartnerLocation}
                  endLocation={activeTripEndLocation}
                  heightClassName="h-72"
                  currentMarkerStyle="bike"
                />
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  Map is unavailable because this order has no usable coordinates.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {activeOrder.status === "shipped" && (
                  <button
                    type="button"
                    onClick={() => startTrip(activeOrder._id)}
                    disabled={jobActionOrderId === activeOrder._id}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Truck size={16} />
                    {jobActionOrderId === activeOrder._id ? "Starting..." : "Start Trip"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => openDirections("google")}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  <Navigation size={16} />
                  Google Maps
                </button>
                <button
                  type="button"
                  onClick={() => openDirections("waze")}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  <Route size={16} />
                  Waze
                </button>

                {activeOrder.status === "in_transit" && (
                  <button
                    type="button"
                    onClick={() => {
                      setOtpModalOrder(activeOrder);
                      setOtpValue("");
                    }}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    <ShieldCheck size={16} />
                    Enter Delivery OTP
                  </button>
                )}
              </div>
            </div>
          )}
        </MotionSection>

        <div className="grid gap-5 lg:grid-cols-2">
          <MotionSection
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.04 }}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Available Jobs</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {availableJobs.length}
              </span>
            </div>

            {loadingJobs ? (
              <p className="text-sm text-slate-500">Loading new jobs...</p>
            ) : availableJobs.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                No open jobs right now.
              </p>
            ) : (
              <div className="space-y-3">
                {availableJobs.map((job) => (
                  <MotionArticle
                    key={job._id}
                    layout
                    className="rounded-xl border border-slate-200 p-3"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{job.orderId}</p>
                        <p className="text-xs text-slate-500">{job.storeId?.storeName || "Store"}</p>
                      </div>
                      <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">
                        {ORDER_STATUS_LABELS[job.status] || job.status}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      <p className="line-clamp-1">Address: {job.deliveryAddress || "Not provided"}</p>
                      <p>Amount: {formatMoney(job.totalAmount)}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => claimJob(job._id)}
                      disabled={!isOnline || jobActionOrderId === job._id}
                      className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle2 size={16} />
                      {jobActionOrderId === job._id ? "Accepting..." : "Accept Job"}
                    </button>
                  </MotionArticle>
                ))}
              </div>
            )}
          </MotionSection>

          <MotionSection
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.06 }}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Assigned Deliveries</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {assignedDeliveries.length}
              </span>
            </div>

            {loadingDeliveries ? (
              <p className="text-sm text-slate-500">Loading assigned deliveries...</p>
            ) : deliveries.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                No deliveries found for your account yet.
              </p>
            ) : (
              <div className="space-y-3">
                {deliveries.slice(0, 8).map((order) => (
                  <article key={order._id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{order.orderId}</p>
                        <p className="text-xs text-slate-500">{order.clientName || "Customer"}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadgeClass(order.status)}`}>
                        {ORDER_STATUS_LABELS[order.status] || order.status}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      <p className="line-clamp-1">{order.deliveryAddress || "Address unavailable"}</p>
                      <p className="inline-flex items-center gap-1">
                        <Phone size={12} />
                        {order.clientPhone || "No phone"}
                      </p>
                    </div>

                    {order.status === "in_transit" && (
                      <button
                        type="button"
                        onClick={() => {
                          setOtpModalOrder(order);
                          setOtpValue("");
                        }}
                        className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                      >
                        <ShieldCheck size={16} />
                        Enter Delivery OTP
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </MotionSection>
        </div>
      </div>

      <AnimatePresence>
        {newOrderPrompt && (
          <MotionAside
            initial={{ opacity: 0, y: 120 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 120 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="fixed inset-x-3 bottom-4 z-50 mx-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">New Order</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{newOrderPrompt.order.orderId}</p>
                <p className="mt-1 text-xs text-slate-600 line-clamp-1">
                  {newOrderPrompt.order.storeId?.storeName || "Store"} - {newOrderPrompt.order.deliveryAddress || "Address unavailable"}
                </p>
              </div>

              <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <Timer size={13} />
                {newOrderCountdown}s
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNewOrderPrompt(null)}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Dismiss
              </button>
              <button
                type="button"
                disabled={!canAcceptPrompt || jobActionOrderId === newOrderPrompt.order._id}
                onClick={() => claimJob(newOrderPrompt.order._id)}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {jobActionOrderId === newOrderPrompt.order._id
                  ? "Accepting..."
                  : canAcceptPrompt
                    ? "Accept in Time"
                    : "Already Assigned"}
              </button>
            </div>
          </MotionAside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {otpModalOrder && (
          <MotionDiv
            className="fixed inset-0 z-[60] flex items-end bg-slate-900/50 p-3 sm:items-center sm:justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <MotionDiv
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              transition={{ type: "spring", stiffness: 240, damping: 24 }}
              className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl sm:p-5"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">Verify Delivery</p>
                  <p className="text-sm font-semibold text-slate-900">Order {otpModalOrder.orderId}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOtpModalOrder(null);
                    setOtpValue("");
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mb-3 grid grid-cols-4 gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`otp-slot-${index}`}
                    className="flex h-12 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xl font-bold tracking-[0.18em] text-slate-900"
                  >
                    {otpValue[index] || "_"}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {otpKeypadKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (key === "clear") {
                        setOtpValue("");
                        return;
                      }

                      if (key === "back") {
                        setOtpValue((previousValue) => previousValue.slice(0, -1));
                        return;
                      }

                      setOtpValue((previousValue) =>
                        previousValue.length >= 4 ? previousValue : `${previousValue}${key}`,
                      );
                    }}
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-base font-semibold text-slate-800 hover:bg-slate-100"
                  >
                    {key === "clear" ? <Delete size={16} /> : key === "back" ? <X size={16} /> : key}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => verifyDeliveryOtp(otpModalOrder, otpValue)}
                disabled={verifyActionOrderId === otpModalOrder._id}
                className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ShieldCheck size={16} />
                {verifyActionOrderId === otpModalOrder._id ? "Verifying..." : "Verify OTP and Complete"}
              </button>
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>
    </section>
  );
};

export default PartnerDashboard;

