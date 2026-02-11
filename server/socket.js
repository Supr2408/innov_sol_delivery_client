import { Server } from "socket.io";
import orderModel from "./models/orderModel.js";

let ioInstance;
let heartbeatSweepTimer;

const isValidCoordinate = (value) => Number.isFinite(Number(value));
const ARRIVAL_RADIUS_METERS = 50;
const HEARTBEAT_TIMEOUT_MS = Number(process.env.PARTNER_HEARTBEAT_TIMEOUT_MS || 20000);
const HEARTBEAT_SWEEP_INTERVAL_MS = Number(process.env.PARTNER_HEARTBEAT_SWEEP_INTERVAL_MS || 5000);
const ACTIVE_DELIVERY_STATUSES = ["shipped", "in_transit"];
const partnerHeartbeatRegistry = new Map();
const partnerTrackingUnavailableRegistry = new Map();
const orderArrivalRegistry = new Map();

const calculateDistanceMeters = (firstPoint, secondPoint) => {
  const earthRadiusMeters = 6371000;
  const radiansFactor = Math.PI / 180;
  const latitudeDelta = (secondPoint.lat - firstPoint.lat) * radiansFactor;
  const longitudeDelta = (secondPoint.lng - firstPoint.lng) * radiansFactor;
  const firstLatitudeInRadians = firstPoint.lat * radiansFactor;
  const secondLatitudeInRadians = secondPoint.lat * radiansFactor;
  const haversineValue =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitudeInRadians) *
      Math.cos(secondLatitudeInRadians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue));
};

const notifyStoreTrackingAvailability = async (partnerId, isTrackingUnavailable, reason) => {
  if (!partnerId) return;

  const activeOrders = await orderModel
    .find({
      partnerId,
      status: { $in: ACTIVE_DELIVERY_STATUSES },
    })
    .select("_id storeId");

  if (!activeOrders.length) return;

  const availabilityEventName = isTrackingUnavailable
    ? "partner:tracking:unavailable"
    : "partner:tracking:restored";

  activeOrders.forEach((order) => {
    ioInstance.to(`store:${order.storeId}`).emit(availabilityEventName, {
      orderId: order._id,
      partnerId,
      reason,
      timestamp: new Date().toISOString(),
    });
  });
};

const markPartnerTrackingUnavailable = async (partnerId, reason) => {
  const normalizedPartnerId = String(partnerId);
  if (partnerTrackingUnavailableRegistry.get(normalizedPartnerId)) return;

  partnerTrackingUnavailableRegistry.set(normalizedPartnerId, true);
  await notifyStoreTrackingAvailability(normalizedPartnerId, true, reason);
};

const markPartnerTrackingRestored = async (partnerId) => {
  const normalizedPartnerId = String(partnerId);
  if (!partnerTrackingUnavailableRegistry.get(normalizedPartnerId)) return;

  partnerTrackingUnavailableRegistry.set(normalizedPartnerId, false);
  await notifyStoreTrackingAvailability(normalizedPartnerId, false, "heartbeat_restored");
};

const touchPartnerHeartbeat = async (socketId, partnerId) => {
  if (!partnerId) return;

  const normalizedPartnerId = String(partnerId);
  const existingSession = partnerHeartbeatRegistry.get(normalizedPartnerId) || {
    socketIds: new Set(),
    lastHeartbeatAt: Date.now(),
  };

  existingSession.socketIds.add(socketId);
  existingSession.lastHeartbeatAt = Date.now();
  partnerHeartbeatRegistry.set(normalizedPartnerId, existingSession);

  await markPartnerTrackingRestored(normalizedPartnerId);
};

const unregisterPartnerSocket = async (socketId, partnerId) => {
  if (!partnerId) return;

  const normalizedPartnerId = String(partnerId);
  const existingSession = partnerHeartbeatRegistry.get(normalizedPartnerId);
  if (!existingSession) return;

  existingSession.socketIds.delete(socketId);

  if (existingSession.socketIds.size === 0) {
    partnerHeartbeatRegistry.delete(normalizedPartnerId);
    await markPartnerTrackingUnavailable(normalizedPartnerId, "connection_lost");
    return;
  }

  partnerHeartbeatRegistry.set(normalizedPartnerId, existingSession);
};

export const initSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      credentials: true,
    },
  });

  if (heartbeatSweepTimer) {
    clearInterval(heartbeatSweepTimer);
  }

  heartbeatSweepTimer = setInterval(async () => {
    try {
      const now = Date.now();
      const timeoutChecks = Array.from(partnerHeartbeatRegistry.entries()).map(
        async ([partnerId, session]) => {
          if (!session.socketIds.size) {
            await markPartnerTrackingUnavailable(partnerId, "connection_lost");
            return;
          }

          if (now - session.lastHeartbeatAt > HEARTBEAT_TIMEOUT_MS) {
            await markPartnerTrackingUnavailable(partnerId, "heartbeat_timeout");
          }
        },
      );

      await Promise.all(timeoutChecks);
    } catch (error) {
      console.error("partner heartbeat sweep failed", error.message);
    }
  }, HEARTBEAT_SWEEP_INTERVAL_MS);

  ioInstance.on("connection", (socket) => {
    socket.on("join:store", (storeId) => {
      if (storeId) socket.join(`store:${storeId}`);
    });

    socket.on("join:user", (userId) => {
      if (userId) socket.join(`user:${userId}`);
    });

    socket.on("join:partner", (partnerId) => {
      if (!partnerId) return;
      socket.join(`partner:${partnerId}`);
      socket.data.partnerId = String(partnerId);
      touchPartnerHeartbeat(socket.id, partnerId).catch((error) => {
        console.error("join:partner heartbeat failed", error.message);
      });
    });

    socket.on("join:partners:pool", () => {
      socket.join("partners:pool");
    });

    socket.on("leave:partners:pool", () => {
      socket.leave("partners:pool");
    });

    socket.on("partner:heartbeat", (payload = {}) => {
      const resolvedPartnerId = payload.partnerId || socket.data.partnerId;
      if (!resolvedPartnerId) return;

      socket.data.partnerId = String(resolvedPartnerId);
      touchPartnerHeartbeat(socket.id, resolvedPartnerId).catch((error) => {
        console.error("partner:heartbeat failed", error.message);
      });
    });

    socket.on("partner:location:update", async (payload = {}) => {
      try {
        const { orderId, partnerId, lat, lng } = payload;

        if (!orderId || !partnerId || !isValidCoordinate(lat) || !isValidCoordinate(lng)) {
          return;
        }

        socket.data.partnerId = String(partnerId);
        await touchPartnerHeartbeat(socket.id, partnerId);

        const order = await orderModel
          .findById(orderId)
          .select("_id partnerId clientId storeId status customerLocation");
        if (!order || !order.partnerId) return;

        if (String(order.partnerId) !== String(partnerId)) {
          return;
        }

        if (!ACTIVE_DELIVERY_STATUSES.includes(order.status)) {
          orderArrivalRegistry.delete(String(orderId));
          return;
        }

        const partnerCurrentLocation = {
          lat: Number(lat),
          lng: Number(lng),
          updatedAt: new Date(),
        };

        await orderModel.findByIdAndUpdate(orderId, { partnerCurrentLocation });

        const eventPayload = {
          orderId,
          partnerId,
          partnerCurrentLocation,
        };

        ioInstance.to(`partner:${partnerId}`).emit("order:partner:location", eventPayload);
        ioInstance.to(`user:${order.clientId}`).emit("order:user:partner-location", eventPayload);
        ioInstance.to(`store:${order.storeId}`).emit("order:store:partner-location", eventPayload);

        const payloadEndLocation =
          isValidCoordinate(payload?.endLocation?.lat) && isValidCoordinate(payload?.endLocation?.lng)
            ? {
                lat: Number(payload.endLocation.lat),
                lng: Number(payload.endLocation.lng),
              }
            : null;
        const persistedEndLocation =
          isValidCoordinate(order.customerLocation?.lat) && isValidCoordinate(order.customerLocation?.lng)
            ? {
                lat: Number(order.customerLocation.lat),
                lng: Number(order.customerLocation.lng),
              }
            : null;
        const endLocation = payloadEndLocation || persistedEndLocation;

        if (endLocation) {
          const currentDistanceMeters = calculateDistanceMeters(partnerCurrentLocation, endLocation);
          const normalizedOrderId = String(orderId);
          const wasPreviouslyArrived = orderArrivalRegistry.get(normalizedOrderId) || false;

          if (currentDistanceMeters <= ARRIVAL_RADIUS_METERS && !wasPreviouslyArrived) {
            const arrivalPayload = {
              orderId,
              partnerId,
              partnerCurrentLocation,
              endLocation,
              distanceMeters: Math.round(currentDistanceMeters),
              arrivedAt: new Date().toISOString(),
            };

            ioInstance.to(`user:${order.clientId}`).emit("partner:arrived", arrivalPayload);
            ioInstance.to(`store:${order.storeId}`).emit("partner:arrived", arrivalPayload);
            orderArrivalRegistry.set(normalizedOrderId, true);
          } else if (currentDistanceMeters > ARRIVAL_RADIUS_METERS * 1.5 && wasPreviouslyArrived) {
            orderArrivalRegistry.set(normalizedOrderId, false);
          }
        }
      } catch (error) {
        console.error("partner:location:update failed", error.message);
      }
    });

    socket.on("disconnect", () => {
      unregisterPartnerSocket(socket.id, socket.data.partnerId).catch((error) => {
        console.error("partner disconnect tracking failed", error.message);
      });
    });
  });

  return ioInstance;
};

export const getIO = () => {
  if (!ioInstance) {
    throw new Error("Socket.io has not been initialized. Call initSocket first.");
  }

  return ioInstance;
};
