import mongoose from "mongoose";
import orderModel from "../models/orderModel.js";
import partnerModel from "../models/partnerModel.js";
import storeModel from "../models/storeModel.js";
import userModel from "../models/userModel.js";
import walletModel from "../models/walletModel.js";
import { sendPushToDeviceTokens } from "../services/fcmService.js";
import { getIO } from "../socket.js";

const ORDER_STATUS = {
  RECEIVED: "pending",
  PREPARING: "confirmed",
  PARTNER_ASSIGNED: "shipped",
  OUT_FOR_DELIVERY: "in_transit",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

const STATUS_FLOW = [
  ORDER_STATUS.RECEIVED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.PARTNER_ASSIGNED,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERED,
];

const BASE_DELIVERY_FEE = Number(process.env.BASE_DELIVERY_FEE || 2.49);
const DELIVERY_FEE_PER_KM = Number(process.env.DELIVERY_FEE_PER_KM || 0.75);
const PLATFORM_FEE_RATE = Number(process.env.PLATFORM_FEE_RATE || 0.05);
const STORE_EARNING_SHARE = Number(process.env.STORE_EARNING_SHARE || 0.8);

const roundCurrency = (value) => Math.round((Number(value) || 0) * 100) / 100;
const toFiniteNumber = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const buildHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const toLocation = (point) => {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    lat,
    lng,
    label: point?.label || "",
  };
};

const toGeoPoint = (location) => {
  if (!location) return null;
  const lat = Number(location.lat);
  const lng = Number(location.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    type: "Point",
    coordinates: [lng, lat],
  };
};

const resolveEntityId = (entity) => {
  if (!entity) return "";
  if (typeof entity === "string") return entity;
  if (entity?._id) return String(entity._id);
  return String(entity);
};

const isSocketRoomActive = (io, roomName) => {
  if (!io?.sockets?.adapter?.rooms?.get || !roomName) return false;
  const room = io.sockets.adapter.rooms.get(roomName);
  return Boolean(room && room.size > 0);
};

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

const calculateDeliveryFee = (distanceKm, hasDistance) => {
  if (!hasDistance) {
    return roundCurrency(BASE_DELIVERY_FEE);
  }

  return roundCurrency(BASE_DELIVERY_FEE + Math.max(0, distanceKm) * DELIVERY_FEE_PER_KM);
};

const calculatePlatformFee = (baseSubtotal) =>
  roundCurrency(Math.max(0, toFiniteNumber(baseSubtotal)) * PLATFORM_FEE_RATE);

const generateDeliveryOTP = () => `${Math.floor(1000 + Math.random() * 9000)}`;

const extractStoreLocationFromStoreDoc = (store) => {
  const coordinates = Array.isArray(store?.location?.coordinates)
    ? store.location.coordinates
    : [];

  if (coordinates.length === 2) {
    return {
      lat: Number(coordinates[1]),
      lng: Number(coordinates[0]),
      label: store?.address || store?.storeName || "Store",
    };
  }

  return null;
};

const extractStoreLocationFromOrder = (order) => {
  const populatedStoreCoordinates = Array.isArray(order?.storeId?.location?.coordinates)
    ? order.storeId.location.coordinates
    : [];

  if (populatedStoreCoordinates.length === 2) {
    return {
      lat: Number(populatedStoreCoordinates[1]),
      lng: Number(populatedStoreCoordinates[0]),
      label: order?.storeId?.address || order?.storeId?.storeName || "Store",
    };
  }

  return toLocation(order?.storeLocation);
};

const emitDeliveryOTPToUser = (order, deliveryOTP) => {
  const clientId = resolveEntityId(order?.clientId);
  if (!clientId || !deliveryOTP) return;

  const io = getIO();
  io.to(`user:${clientId}`).emit("order:user:delivery-otp", {
    orderId: order._id,
    deliveryOTP,
  });
};

const syncPartnerAvailability = async (partnerId) => {
  if (!partnerId) return;

  const hasActiveJobs = await orderModel.exists({
    partnerId,
    status: {
      $in: [ORDER_STATUS.PARTNER_ASSIGNED, ORDER_STATUS.OUT_FOR_DELIVERY],
    },
  });

  await partnerModel.findByIdAndUpdate(partnerId, {
    isAvailable: !Boolean(hasActiveJobs),
  });
};

const isValidStatusTransition = (currentStatus, nextStatus) => {
  if (nextStatus === ORDER_STATUS.CANCELLED) return currentStatus !== ORDER_STATUS.DELIVERED;

  const currentIndex = STATUS_FLOW.indexOf(currentStatus);
  const nextIndex = STATUS_FLOW.indexOf(nextStatus);

  if (currentIndex === -1 || nextIndex === -1) return false;

  return nextIndex === currentIndex + 1;
};

const emitOrderStatus = async (order) => {
  const io = getIO();

  const storeId = resolveEntityId(order?.storeId);
  const clientId = resolveEntityId(order?.clientId);
  const partnerId = resolveEntityId(order?.partnerId);

  if (storeId) {
    io.to(`store:${storeId}`).emit("order:store:updated", {
      orderId: order._id,
      status: order.status,
      order,
    });
  }

  if (clientId) {
    io.to(`user:${clientId}`).emit("order:user:tracking", {
      orderId: order._id,
      status: order.status,
      progressFlow: STATUS_FLOW,
      order,
    });
  }

  if (partnerId) {
    io.to(`partner:${partnerId}`).emit("order:partner:updated", {
      orderId: order._id,
      status: order.status,
      order,
    });
  }

  if (clientId && !isSocketRoomActive(io, `user:${clientId}`)) {
    const user = await userModel.findById(clientId).select("deviceTokens");
    const deviceTokens = (user?.deviceTokens || [])
      .map((entry) => entry?.token)
      .filter(Boolean);

    await sendPushToDeviceTokens(deviceTokens, {
      title: "Order status updated",
      body: `Your order ${order.orderId || ""} is now ${order.status}`.trim(),
      data: {
        orderId: order._id,
        status: order.status,
        event: "order:status:updated",
      },
    });
  }
};

const emitPartnerJobPoolAlert = async (order, radiusInKm = 10) => {
  const io = getIO();
  const storeLocation = extractStoreLocationFromOrder(order);
  const storeName =
    typeof order.storeId === "object" && order.storeId?.storeName
      ? order.storeId.storeName
      : order.storeLocation?.label || "Store";

  const radiusInMeters = Math.max(1, Number(radiusInKm || 10)) * 1000;
  const storeGeoPoint = toGeoPoint(storeLocation);

  if (!storeGeoPoint) {
    return;
  }

  const nearbyPartners = await partnerModel
    .find({
      isAvailable: true,
      location: {
        $near: {
          $geometry: storeGeoPoint,
          $maxDistance: radiusInMeters,
        },
      },
    })
    .select("_id");

  if (!nearbyPartners.length) {
    return;
  }

  const payload = {
    title: "New Delivery Available",
    message: `Pickup from ${storeName} within ${radiusInKm}km radius`,
    order,
    radiusInKm,
  };

  nearbyPartners.forEach((partner) => {
    io.to(`partner:${partner._id}`).emit("partner:job:new", payload);
  });
};

const creditWallet = async ({ walletType, partnerId, storeId, creditAmount, creditedAt, session }) => {
  const amount = roundCurrency(creditAmount);
  if (amount <= 0) return null;

  const dateKey = new Date(creditedAt).toISOString().slice(0, 10);
  const filter =
    walletType === "partner"
      ? { walletType: "partner", partnerId }
      : { walletType: "store", storeId };

  const update = {
    $inc: {
      totalBalance: amount,
      totalEarned: amount,
      [`dailyEarnings.${dateKey}`]: amount,
    },
    $set: {
      lastCreditedAt: creditedAt,
    },
    $setOnInsert: {
      walletType,
      partnerId: walletType === "partner" ? partnerId : null,
      storeId: walletType === "store" ? storeId : null,
    },
  };

  return walletModel.findOneAndUpdate(filter, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
    session,
  });
};

// Get all orders for a store
export const getStoreOrders = async (req, res) => {
  try {
    const { storeId } = req.params;

    const orders = await orderModel
      .find({ storeId })
      .sort({ createdAt: -1 })
      .populate("partnerId", "name phone vehicle")
      .populate("storeId", "storeName address city phone location");

    res.status(200).json({
      message: "Orders retrieved successfully",
      orders,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get orders by status
export const getOrdersByStatus = async (req, res) => {
  try {
    const { storeId, status } = req.params;

    const orders = await orderModel
      .find({ storeId, status })
      .sort({ createdAt: -1 })
      .populate("storeId", "storeName address city phone location");

    res.status(200).json({
      message: `${status} orders retrieved successfully`,
      count: orders.length,
      orders,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get delivery partners who shipped items from store
export const getDeliveryPartners = async (req, res) => {
  try {
    const { storeId } = req.params;

    const orders = await orderModel
      .find({
        storeId,
        partnerId: { $ne: null },
      })
      .populate("partnerId", "name email phone vehicle");

    const partnersMap = new Map();

    orders.forEach((order) => {
      if (!order.partnerId) return;

      const key = order.partnerId._id.toString();

      if (!partnersMap.has(key)) {
        partnersMap.set(key, {
          id: order.partnerId._id,
          name: order.partnerId.name,
          email: order.partnerId.email,
          phone: order.partnerId.phone,
          vehicle: order.partnerId.vehicle,
          totalDeliveries: 0,
          totalAmount: 0,
        });
      }

      const partner = partnersMap.get(key);

      if (order.status === ORDER_STATUS.DELIVERED) {
        partner.totalDeliveries += 1;
        partner.totalAmount += order.totalAmount;
      }
    });

    const partners = Array.from(partnersMap.values());

    res.status(200).json({
      message: "Delivery partners retrieved successfully",
      count: partners.length,
      partners,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get stock summary
export const getStockSummary = async (req, res) => {
  try {
    const { storeId } = req.params;

    const orders = await orderModel.find({ storeId });

    const stockChanges = {};

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const key = item.itemId.toString();

        if (!stockChanges[key]) {
          stockChanges[key] = {
            itemName: item.itemName,
            totalOrdered: 0,
            totalDelivered: 0,
          };
        }

        stockChanges[key].totalOrdered += item.quantity;

        if (order.status === ORDER_STATUS.DELIVERED) {
          stockChanges[key].totalDelivered += item.quantity;
        }
      });
    });

    res.status(200).json({
      message: "Stock summary retrieved successfully",
      stockChanges,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update order status with enterprise status flow
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, partnerId, estimatedDelivery, proofOfDeliveryImage } = req.body;
    const normalizedStatus = typeof status === "string" ? status.trim() : status;

    const order = await orderModel.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!isValidStatusTransition(order.status, normalizedStatus)) {
      return res.status(400).json({
        message: `Invalid status transition from ${order.status} to ${normalizedStatus}`,
      });
    }

    if (normalizedStatus === ORDER_STATUS.DELIVERED) {
      return res.status(400).json({
        message: "Use OTP verification endpoint to complete this delivery",
      });
    }

    const updates = {
      status: normalizedStatus,
      estimatedDelivery,
    };

    if (normalizedStatus === ORDER_STATUS.PARTNER_ASSIGNED) {
      const selectedPartner = partnerId;

      if (!selectedPartner) {
        return res.status(400).json({
          message: "partnerId is required to assign this order",
        });
      }

      updates.partnerId = selectedPartner;
      updates.shippedAt = new Date();
      updates.deliveryOTP = generateDeliveryOTP();
      updates.isVerified = false;
    }

    if (normalizedStatus === ORDER_STATUS.CANCELLED && proofOfDeliveryImage) {
      updates.proofOfDeliveryImage = proofOfDeliveryImage;
    }

    const updatedOrder = await orderModel
      .findByIdAndUpdate(orderId, updates, { new: true })
      .populate("partnerId", "name phone vehicle")
      .populate("storeId", "storeName address city phone location");

    if (normalizedStatus === ORDER_STATUS.PREPARING) {
      await emitPartnerJobPoolAlert(updatedOrder, 10);
    }

    if (normalizedStatus === ORDER_STATUS.PARTNER_ASSIGNED) {
      emitDeliveryOTPToUser(updatedOrder, updates.deliveryOTP);
    }

    if (normalizedStatus === ORDER_STATUS.PARTNER_ASSIGNED && updatedOrder.partnerId?._id) {
      await syncPartnerAvailability(updatedOrder.partnerId._id);
    }

    if (
      (normalizedStatus === ORDER_STATUS.DELIVERED || normalizedStatus === ORDER_STATUS.CANCELLED) &&
      updatedOrder.partnerId?._id
    ) {
      await syncPartnerAvailability(updatedOrder.partnerId._id);
    }

    await emitOrderStatus(updatedOrder);

    return res.status(200).json({
      message: "Order status updated successfully",
      order: updatedOrder,
      lifecycle: STATUS_FLOW,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Create order (for testing/demo)
export const createOrder = async (req, res) => {
  try {
    const { storeId: routeStoreId } = req.params;
    const {
      storeId: bodyStoreId,
      clientId,
      items,
      deliveryAddress,
      customerLocation,
      clientName,
      clientPhone,
    } = req.body;

    const storeId = bodyStoreId || routeStoreId;

    if (!storeId || !clientId) {
      return res.status(400).json({ message: "storeId and clientId are required" });
    }

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: "At least one item is required" });
    }

    if (!String(deliveryAddress || "").trim()) {
      return res.status(400).json({ message: "deliveryAddress is required" });
    }

    const store = await storeModel
      .findById(storeId)
      .select("_id storeName address city phone location");

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    const sanitizedItems = items
      .map((item) => {
        const quantity = Math.max(0, toFiniteNumber(item.quantity));
        const price = Math.max(0, toFiniteNumber(item.price));
        const subtotal = roundCurrency(quantity * price);

        return {
          itemId: item.itemId,
          itemName: item.itemName,
          quantity,
          price,
          subtotal,
        };
      })
      .filter((item) => item.quantity > 0);

    if (!sanitizedItems.length) {
      return res.status(400).json({ message: "Items must include valid quantity and price" });
    }

    const baseSubtotal = roundCurrency(
      sanitizedItems.reduce((sum, item) => sum + roundCurrency(item.subtotal), 0),
    );

    const sanitizedCustomerLocation = toLocation({
      lat: customerLocation?.lat,
      lng: customerLocation?.lng,
      label: customerLocation?.label || deliveryAddress,
    });
    const storeLocation = extractStoreLocationFromStoreDoc(store);

    const hasDistanceInputs = Boolean(sanitizedCustomerLocation && storeLocation);
    const distanceKm = hasDistanceInputs
      ? calculateDistanceKm(storeLocation, sanitizedCustomerLocation)
      : 0;

    const deliveryFee = calculateDeliveryFee(distanceKm, hasDistanceInputs);
    const platformFee = calculatePlatformFee(baseSubtotal);
    const totalAmount = roundCurrency(baseSubtotal + deliveryFee + platformFee);

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;

    const newOrder = await orderModel.create({
      orderId,
      storeId,
      clientId,
      items: sanitizedItems,
      baseSubtotal,
      deliveryFee,
      platformFee,
      totalAmount,
      deliveryAddress,
      customerLocation: sanitizedCustomerLocation || undefined,
      storeLocation: storeLocation || undefined,
      clientName,
      clientPhone,
      status: ORDER_STATUS.RECEIVED,
    });

    const io = getIO();

    io.to(`store:${newOrder.storeId}`).emit("order:store:new", {
      title: "New order received",
      playSound: true,
      order: newOrder,
    });

    io.to(`user:${newOrder.clientId}`).emit("order:user:tracking", {
      orderId: newOrder._id,
      status: ORDER_STATUS.RECEIVED,
      progressFlow: STATUS_FLOW,
      order: newOrder,
    });

    res.status(201).json({
      message: "Order created successfully",
      order: newOrder,
      lifecycle: STATUS_FLOW,
      pricing: {
        baseSubtotal,
        deliveryFee,
        platformFee,
        totalAmount,
        distanceKm: roundCurrency(distanceKm),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get user's orders
export const getUserOrders = async (req, res) => {
  try {
    const { userId } = req.params;

    const orders = await orderModel
      .find({ clientId: userId })
      .sort({ createdAt: -1 })
      .populate("partnerId", "name phone vehicle")
      .populate("storeId", "storeName address city phone location");

    res.status(200).json({
      message: "User orders retrieved successfully",
      orders,
      lifecycle: STATUS_FLOW,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get user's tracking info (active deliveries)
export const getUserTracking = async (req, res) => {
  try {
    const { userId } = req.params;

    const tracking = await orderModel
      .find({
        clientId: userId,
        status: {
          $in: [
            ORDER_STATUS.RECEIVED,
            ORDER_STATUS.PREPARING,
            ORDER_STATUS.PARTNER_ASSIGNED,
            ORDER_STATUS.OUT_FOR_DELIVERY,
          ],
        },
      })
      .select("+deliveryOTP")
      .sort({ createdAt: -1 })
      .populate("partnerId", "name phone vehicle")
      .populate("storeId", "storeName address city phone location");

    res.status(200).json({
      message: "User tracking info retrieved",
      tracking,
      lifecycle: STATUS_FLOW,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const verifyAndCompleteOrder = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { orderId } = req.params;
    const { partnerId, deliveryOTP } = req.body;
    const proofOfDeliveryImagePath = req.file?.filename ? `/uploads/${req.file.filename}` : "";

    if (!partnerId) {
      return res.status(400).json({ message: "partnerId is required" });
    }

    const normalizedDeliveryOTP = String(deliveryOTP || "").trim();
    if (!/^\d{4}$/.test(normalizedDeliveryOTP)) {
      return res.status(400).json({ message: "A valid 4-digit delivery OTP is required" });
    }

    await session.withTransaction(async () => {
      const order = await orderModel.findById(orderId).select("+deliveryOTP").session(session);
      if (!order) {
        throw buildHttpError(404, "Order not found");
      }

      if (order.status !== ORDER_STATUS.OUT_FOR_DELIVERY) {
        throw buildHttpError(409, `Order cannot be verified in ${order.status} status`);
      }

      if (!order.partnerId || String(order.partnerId) !== String(partnerId)) {
        throw buildHttpError(403, "Only the assigned partner can verify this order");
      }

      if (order.isVerified) {
        throw buildHttpError(409, "Order is already verified");
      }

      if (order.isWalletCredited) {
        throw buildHttpError(409, "Order wallet settlement is already completed");
      }

      if (String(order.deliveryOTP || "") !== normalizedDeliveryOTP) {
        throw buildHttpError(400, "Invalid delivery OTP");
      }

      const deliveredAt = new Date();
      const storeWalletCreditAmount = roundCurrency(
        toFiniteNumber(order.totalAmount) * STORE_EARNING_SHARE,
      );
      const partnerWalletCreditAmount = roundCurrency(toFiniteNumber(order.deliveryFee));

      await creditWallet({
        walletType: "store",
        storeId: order.storeId,
        creditAmount: storeWalletCreditAmount,
        creditedAt: deliveredAt,
        session,
      });

      await creditWallet({
        walletType: "partner",
        partnerId: order.partnerId,
        creditAmount: partnerWalletCreditAmount,
        creditedAt: deliveredAt,
        session,
      });

      const deliveryCompletionUpdates = {
        status: ORDER_STATUS.DELIVERED,
        isVerified: true,
        deliveryOTP: null,
        deliveredAt,
        actualDelivery: deliveredAt,
        isWalletCredited: true,
        storeWalletCreditAmount,
        partnerWalletCreditAmount,
      };

      if (proofOfDeliveryImagePath) {
        deliveryCompletionUpdates.proofOfDeliveryImage = proofOfDeliveryImagePath;
      }

      await orderModel.findByIdAndUpdate(orderId, deliveryCompletionUpdates, { new: true, session });
    });

    const updatedOrder = await orderModel
      .findById(orderId)
      .populate("partnerId", "name phone vehicle")
      .populate("storeId", "storeName address city phone location");

    await syncPartnerAvailability(partnerId);
    await emitOrderStatus(updatedOrder);

    return res.status(200).json({
      message: "Order verified and delivered successfully",
      order: updatedOrder,
      lifecycle: STATUS_FLOW,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  } finally {
    await session.endSession();
  }
};

// Get partner orders
export const getPartnerOrders = async (req, res) => {
  try {
    const { partnerId } = req.params;

    const orders = await orderModel
      .find({ partnerId })
      .sort({ createdAt: -1 })
      .populate("storeId", "storeName phone address city location");

    res.status(200).json({
      message: "Partner orders retrieved successfully",
      orders,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get open jobs for partner claim
export const getOpenPartnerJobs = async (req, res) => {
  try {
    const jobs = await orderModel
      .find({
        status: ORDER_STATUS.PREPARING,
        partnerId: null,
      })
      .sort({ createdAt: -1 })
      .populate("storeId", "storeName phone address city location");

    res.status(200).json({
      message: "Open jobs retrieved successfully",
      jobs,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Partner claims an available delivery
export const claimPartnerJob = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { partnerId } = req.body;

    if (!partnerId) {
      return res.status(400).json({ message: "partnerId is required" });
    }

    const partner = await partnerModel.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    if (!partner.isAvailable) {
      return res.status(409).json({ message: "Partner is not available" });
    }

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.partnerId) {
      return res.status(409).json({ message: "Order already claimed" });
    }

    if (order.status !== ORDER_STATUS.PREPARING) {
      return res.status(409).json({
        message: `Order cannot be claimed in ${order.status} status`,
      });
    }

    const generatedDeliveryOTP = generateDeliveryOTP();

    const updatedOrder = await orderModel
      .findByIdAndUpdate(
        orderId,
        {
          partnerId,
          status: ORDER_STATUS.PARTNER_ASSIGNED,
          shippedAt: new Date(),
          deliveryOTP: generatedDeliveryOTP,
          isVerified: false,
        },
        { new: true },
      )
      .populate("partnerId", "name phone vehicle")
      .populate("storeId", "storeName address city phone location");

    await syncPartnerAvailability(partnerId);
    emitDeliveryOTPToUser(updatedOrder, generatedDeliveryOTP);
    await emitOrderStatus(updatedOrder);

    return res.status(200).json({
      message: "Job claimed successfully",
      order: updatedOrder,
      lifecycle: STATUS_FLOW,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
