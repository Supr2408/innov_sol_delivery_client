import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { AppContext } from "../../context/AppContext";
import LiveRouteMap from "../../components/LiveRouteMap";

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
    script.addEventListener("error", () => reject(new Error("Socket client failed to load")));
    document.body.appendChild(script);
  });

const getStatusClass = (status) => {
  switch (status) {
    case "confirmed":
      return "bg-indigo-100 text-indigo-700";
    case "shipped":
      return "bg-blue-100 text-blue-700";
    case "in_transit":
      return "bg-orange-100 text-orange-700";
    case "delivered":
      return "bg-green-100 text-green-700";
    case "cancelled":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

const WalletCard = ({ label, value }) => (
  <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
    <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
    <p className="text-xl font-semibold text-gray-900 mt-1">${value.toFixed(2)}</p>
  </div>
);

const PartnerDashboard = () => {
  const { user, token } = useContext(AppContext);
  const partnerId = user?.id || user?._id;

  const [activeTab, setActiveTab] = useState("jobs");
  const [availableJobs, setAvailableJobs] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [actionOrderId, setActionOrderId] = useState(null);
  const [photoUploadingOrderId, setPhotoUploadingOrderId] = useState(null);
  const [liveTrackingOrderId, setLiveTrackingOrderId] = useState(null);

  const socketRef = useRef(null);
  const locationWatchRef = useRef(null);

  const upsertById = (list, order) => {
    const filtered = list.filter((item) => item._id !== order._id);
    return [order, ...filtered];
  };

  const fetchAvailableJobs = async () => {
    try {
      setLoadingJobs(true);
      const { data } = await axios.get("/orders/jobs/open");
      setAvailableJobs(data.jobs || []);
    } catch {
      toast.error("Failed to load available jobs");
    } finally {
      setLoadingJobs(false);
    }
  };

  const fetchDeliveries = async () => {
    try {
      setLoadingDeliveries(true);
      const { data } = await axios.get(`/orders/partner/${partnerId}`);
      setDeliveries(data.orders || []);
    } catch {
      toast.error("Failed to load partner deliveries");
    } finally {
      setLoadingDeliveries(false);
    }
  };

  useEffect(() => {
    if (!partnerId) return;
    fetchAvailableJobs();
    fetchDeliveries();
  }, [partnerId]);

  useEffect(
    () => () => {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    if (!token || !partnerId) return;

    let socket;

    const connectSocket = async () => {
      try {
        const ioClient = await loadSocketClient();

        socket = ioClient(import.meta.env.VITE_BACKEND_URL || "http://localhost:5000", {
          transports: ["websocket"],
          auth: { token },
        });

        socketRef.current = socket;

        socket.on("connect", () => {
          socket.emit("join:partner", partnerId);
          socket.emit("join:partners:pool");
        });

        socket.on("partner:job:new", (payload) => {
          if (!payload?.order?._id) return;

          const incomingOrder = payload.order;
          if (incomingOrder.status === "confirmed" && !incomingOrder.partnerId) {
            setAvailableJobs((prev) => upsertById(prev, incomingOrder));
          }

          toast.info(payload.title || "New delivery available");
        });

        socket.on("order:partner:updated", ({ order }) => {
          if (!order?._id) return;

          setDeliveries((prev) => upsertById(prev, order));
          setAvailableJobs((prev) => prev.filter((job) => job._id !== order._id));
        });

        socket.on("order:partner:location", ({ orderId, partnerCurrentLocation }) => {
          if (!orderId || !partnerCurrentLocation) return;

          setDeliveries((prev) =>
            prev.map((order) =>
              order._id === orderId
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
      if (socket) socket.disconnect();
    };
  }, [token, partnerId]);

  const claimJob = async (orderId) => {
    if (!partnerId) return;

    try {
      setActionOrderId(orderId);
      await axios.post(`/orders/${orderId}/claim`, { partnerId });
      toast.success("Delivery job claimed");
      await Promise.all([fetchAvailableJobs(), fetchDeliveries()]);
      setActiveTab("deliveries");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to claim this job");
    } finally {
      setActionOrderId(null);
    }
  };

  const moveToTransit = async (orderId) => {
    try {
      setActionOrderId(orderId);
      await axios.put(`/orders/${orderId}`, { status: "in_transit" });
      toast.success("Delivery started");
      fetchDeliveries();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to start delivery");
    } finally {
      setActionOrderId(null);
    }
  };

  const stopLiveLocationSharing = () => {
    if (locationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
    }
    setLiveTrackingOrderId(null);
  };

  const startLiveLocationSharing = (orderId) => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported on this device");
      return;
    }

    stopLiveLocationSharing();
    setLiveTrackingOrderId(orderId);

    locationWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        const partnerCurrentLocation = {
          lat,
          lng,
          updatedAt: new Date().toISOString(),
        };

        setDeliveries((prev) =>
          prev.map((order) =>
            order._id === orderId
              ? {
                  ...order,
                  partnerCurrentLocation,
                }
              : order,
          ),
        );

        if (socketRef.current) {
          socketRef.current.emit("partner:location:update", {
            orderId,
            partnerId,
            lat,
            lng,
          });
        }
      },
      () => {
        toast.error("Unable to access live location");
        stopLiveLocationSharing();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 2000,
      },
    );
  };

  const markDeliveredWithPhoto = async (orderId, file) => {
    if (!file) {
      toast.error("Please capture or upload proof of delivery");
      return;
    }

    setPhotoUploadingOrderId(orderId);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "upload_preset",
        import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "delivery_proof",
      );

      const cloudinaryName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      let imageUrl = "";

      if (cloudinaryName) {
        const uploadResponse = await axios.post(
          `https://api.cloudinary.com/v1_1/${cloudinaryName}/image/upload`,
          formData,
        );

        imageUrl = uploadResponse.data.secure_url;
      }

      await axios.put(`/orders/${orderId}`, {
        status: "delivered",
        proofOfDeliveryImage: imageUrl,
      });

      toast.success("Delivery marked as completed");
      await Promise.all([fetchAvailableJobs(), fetchDeliveries()]);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to complete delivery");
    } finally {
      setPhotoUploadingOrderId(null);
    }
  };

  const activeDeliveries = useMemo(
    () =>
      deliveries.filter(
        (order) => order.status !== "delivered" && order.status !== "cancelled",
      ),
    [deliveries],
  );

  const completedDeliveries = useMemo(
    () => deliveries.filter((order) => order.status === "delivered"),
    [deliveries],
  );

  const earnings = useMemo(() => {
    const dailyFees = completedDeliveries.reduce(
      (sum, order) => sum + Number(order.deliveryFee || 3.5),
      0,
    );
    const dailyTips = completedDeliveries.reduce(
      (sum, order) => sum + Number(order.tip || 0),
      0,
    );

    return {
      daily: { fees: dailyFees, tips: dailyTips },
      weekly: {
        fees: dailyFees * 5,
        tips: Math.max(dailyTips * 4, 0),
      },
    };
  }, [completedDeliveries]);

  useEffect(() => {
    if (!liveTrackingOrderId) return;
    const trackedOrder = deliveries.find((order) => order._id === liveTrackingOrderId);
    if (!trackedOrder || trackedOrder.status !== "in_transit") {
      stopLiveLocationSharing();
    }
  }, [deliveries, liveTrackingOrderId]);

  return (
    <section className="min-h-screen bg-gray-50 p-3 sm:p-4 pb-20">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Partner Operations</h1>
          <p className="text-sm text-gray-500">
            Claim available jobs, manage active deliveries, and close orders with proof.
          </p>
        </header>

        <div className="flex gap-2 border-b pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("jobs")}
            className={`px-4 py-2 rounded text-sm font-medium whitespace-nowrap ${
              activeTab === "jobs"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Available Jobs ({availableJobs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("deliveries")}
            className={`px-4 py-2 rounded text-sm font-medium whitespace-nowrap ${
              activeTab === "deliveries"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            My Deliveries ({activeDeliveries.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("wallet")}
            className={`px-4 py-2 rounded text-sm font-medium whitespace-nowrap ${
              activeTab === "wallet"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Wallet
          </button>
        </div>

        {activeTab === "jobs" && (
          <article className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Available Delivery Jobs</h2>
              <button
                type="button"
                onClick={fetchAvailableJobs}
                className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded"
              >
                Refresh
              </button>
            </div>

            <div className="space-y-3">
              {loadingJobs && <p className="text-sm text-gray-500">Loading jobs...</p>}
              {!loadingJobs && availableJobs.length === 0 && (
                <p className="text-sm text-gray-500">No open jobs at the moment.</p>
              )}

              {availableJobs.map((job) => (
                <div key={job._id} className="border border-gray-100 rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-800">Order {job.orderId}</p>
                      <p className="text-sm text-gray-600">Store: {job.storeId?.storeName || "Store"}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700">
                      {ORDER_STATUS_LABELS[job.status] || job.status}
                    </span>
                  </div>

                  <div className="text-sm text-gray-600">
                    <p>Customer: {job.clientName || "N/A"}</p>
                    <p>Address: {job.deliveryAddress || "N/A"}</p>
                    <p>Amount: ${Number(job.totalAmount || 0).toFixed(2)}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => claimJob(job._id)}
                    disabled={actionOrderId === job._id}
                    className="bg-emerald-600 text-white rounded px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {actionOrderId === job._id ? "Claiming..." : "Claim Job"}
                  </button>
                </div>
              ))}
            </div>
          </article>
        )}

        {activeTab === "deliveries" && (
          <article className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">My Delivery Pipeline</h2>
              <button
                type="button"
                onClick={fetchDeliveries}
                className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded"
              >
                Refresh
              </button>
            </div>

            {loadingDeliveries && <p className="text-sm text-gray-500">Loading deliveries...</p>}

            {!loadingDeliveries && activeDeliveries.length === 0 && (
              <p className="text-sm text-gray-500">No active deliveries right now.</p>
            )}

            {activeDeliveries.map((order) => {
              const destinationLocation = {
                lat: Number(order.customerLocation?.lat),
                lng: Number(order.customerLocation?.lng),
              };
              const hasDestinationLocation =
                Number.isFinite(destinationLocation.lat) &&
                Number.isFinite(destinationLocation.lng);
              const liveLocation = order.partnerCurrentLocation;
              const hasLiveLocation =
                Number.isFinite(Number(liveLocation?.lat)) &&
                Number.isFinite(Number(liveLocation?.lng));
              const lastLocationUpdate = liveLocation?.updatedAt
                ? new Date(liveLocation.updatedAt).toLocaleTimeString()
                : null;

              return (
                <div key={order._id} className="border border-gray-100 rounded-xl p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium text-gray-800">Order {order.orderId || order._id.slice(-6)}</h3>
                      <p className="text-sm text-gray-500">
                        Status: {ORDER_STATUS_LABELS[order.status] || order.status}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${getStatusClass(order.status)}`}>
                      {ORDER_STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>

                  <div className="text-sm text-gray-600">
                    <p>Customer: {order.clientName || "N/A"}</p>
                    <p>Phone: {order.clientPhone || "N/A"}</p>
                    <p>Address: {order.deliveryAddress || "N/A"}</p>
                  </div>

                  {hasDestinationLocation ? (
                    <div className="space-y-2">
                      <LiveRouteMap
                        startLocation={hasLiveLocation ? liveLocation : null}
                        endLocation={destinationLocation}
                        currentLocation={hasLiveLocation ? liveLocation : null}
                        heightClassName="h-60"
                      />
                      <p className="text-xs text-gray-500">
                        {hasLiveLocation
                          ? `Live GPS synced at ${lastLocationUpdate}`
                          : "Start live location sharing for shortest-path navigation."}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">Customer map location not available for this order.</p>
                  )}

                  {order.status === "shipped" && (
                    <button
                      type="button"
                      onClick={() => moveToTransit(order._id)}
                      disabled={actionOrderId === order._id}
                      className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                    >
                      {actionOrderId === order._id ? "Updating..." : "Start Delivery"}
                    </button>
                  )}

                  {order.status === "in_transit" && (
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                      <div className="flex gap-2 flex-wrap">
                        {liveTrackingOrderId === order._id ? (
                          <button
                            type="button"
                            onClick={stopLiveLocationSharing}
                            className="bg-amber-500 text-white rounded-lg px-3 py-2 text-sm"
                          >
                            Stop Live Location
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startLiveLocationSharing(order._id)}
                            className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm"
                          >
                            Start Live Location
                          </button>
                        )}

                        <label className="text-sm text-gray-600">
                          Proof of delivery
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="block mt-1 text-xs"
                            onChange={(event) => {
                              const selectedFile = event.target.files?.[0];
                              if (selectedFile) {
                                markDeliveredWithPhoto(order._id, selectedFile);
                              }
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          disabled={photoUploadingOrderId === order._id}
                          className="bg-emerald-600 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                          onClick={() => toast.info("Upload a delivery photo to complete")}
                        >
                          {photoUploadingOrderId === order._id
                            ? "Uploading..."
                            : "Complete with Photo"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {!loadingDeliveries && completedDeliveries.length > 0 && (
              <div className="pt-4 border-t">
                <h3 className="font-semibold text-gray-900 mb-2">Completed Deliveries</h3>
                <div className="space-y-2">
                  {completedDeliveries.slice(0, 5).map((order) => (
                    <div
                      key={order._id}
                      className="border border-gray-100 rounded p-2 text-sm text-gray-600 flex items-center justify-between"
                    >
                      <span>{order.orderId}</span>
                      <span className="text-green-700 font-medium">Delivered</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>
        )}

        {activeTab === "wallet" && (
          <article className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
            <h2 className="font-semibold text-gray-900">Wallet Analytics</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <WalletCard label="Daily Fees" value={earnings.daily.fees} />
              <WalletCard label="Daily Tips" value={earnings.daily.tips} />
              <WalletCard label="Weekly Fees" value={earnings.weekly.fees} />
              <WalletCard label="Weekly Tips" value={earnings.weekly.tips} />
            </div>
            <p className="text-xs text-gray-500">
              Earnings are derived from delivered jobs currently loaded in your account.
            </p>
          </article>
        )}
      </div>
    </section>
  );
};

export default PartnerDashboard;
