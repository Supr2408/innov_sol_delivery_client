import { Server } from "socket.io";
import orderModel from "./models/orderModel.js";

let ioInstance;

const isValidCoordinate = (value) => Number.isFinite(Number(value));

export const initSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      credentials: true,
    },
  });

  ioInstance.on("connection", (socket) => {
    socket.on("join:store", (storeId) => {
      if (storeId) socket.join(`store:${storeId}`);
    });

    socket.on("join:user", (userId) => {
      if (userId) socket.join(`user:${userId}`);
    });

    socket.on("join:partner", (partnerId) => {
      if (partnerId) socket.join(`partner:${partnerId}`);
    });

    socket.on("join:partners:pool", () => {
      socket.join("partners:pool");
    });

    socket.on("partner:location:update", async (payload = {}) => {
      try {
        const { orderId, partnerId, lat, lng } = payload;

        if (!orderId || !partnerId || !isValidCoordinate(lat) || !isValidCoordinate(lng)) {
          return;
        }

        const order = await orderModel.findById(orderId).select("_id partnerId clientId storeId status");
        if (!order || !order.partnerId) return;

        if (String(order.partnerId) !== String(partnerId)) {
          return;
        }

        if (!["shipped", "in_transit"].includes(order.status)) {
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
      } catch (error) {
        console.error("partner:location:update failed", error.message);
      }
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
