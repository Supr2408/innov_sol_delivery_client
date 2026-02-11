import orderModel from "../models/orderModel.js";
import partnerModel from "../models/partnerModel.js";
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

const generateDeliveryOTP = () => `${Math.floor(1000 + Math.random() * 9000)}`;

const emitDeliveryOTPToUser = (order, deliveryOTP) => {
  if (!order?.clientId || !deliveryOTP) return;

  const io = getIO();
  io.to(`user:${order.clientId}`).emit("order:user:delivery-otp", {
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

const emitOrderStatus = (order) => {
  const io = getIO();

  io.to(`store:${order.storeId}`).emit("order:store:updated", {
    orderId: order._id,
    status: order.status,
    order,
  });

  io.to(`user:${order.clientId}`).emit("order:user:tracking", {
    orderId: order._id,
    status: order.status,
    progressFlow: STATUS_FLOW,
    order,
  });

  if (order.partnerId) {
    io.to(`partner:${order.partnerId}`).emit("order:partner:updated", {
      orderId: order._id,
      status: order.status,
      order,
    });
  }
};

const emitPartnerJobPoolAlert = (order, radiusInKm = 10) => {
  const io = getIO();
  const storeName =
    typeof order.storeId === "object" && order.storeId?.storeName
      ? order.storeId.storeName
      : order.storeId;

  io.to("partners:pool").emit("partner:job:new", {
    title: "New Delivery Available",
    message: `Pickup from ${storeName} within ${radiusInKm}km radius`,
    order,
    radiusInKm,
  });
};

const autoAssignPartner = async () => {
  const availablePartners = await partnerModel.find({ isAvailable: true }).select("_id");

  if (!availablePartners.length) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * availablePartners.length);
  return availablePartners[randomIndex]._id;
};

// Get all orders for a store
export const getStoreOrders = async (req, res) => {
  try {
    const { storeId } = req.params;

    const orders = await orderModel
      .find({ storeId })
      .sort({ createdAt: -1 })
      .populate("partnerId", "name phone vehicle");

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

    const orders = await orderModel.find({ storeId, status }).sort({ createdAt: -1 });

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
      .populate("storeId", "storeName address city phone");

    if (normalizedStatus === ORDER_STATUS.PREPARING) {
      emitPartnerJobPoolAlert(updatedOrder, 8);
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

    emitOrderStatus(updatedOrder);

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
      totalAmount,
      deliveryAddress,
      customerLocation,
      clientName,
      clientPhone,
    } = req.body;

    const storeId = bodyStoreId || routeStoreId;

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;

    const sanitizedCustomerLocation =
      customerLocation &&
      Number.isFinite(Number(customerLocation.lat)) &&
      Number.isFinite(Number(customerLocation.lng))
        ? {
            lat: Number(customerLocation.lat),
            lng: Number(customerLocation.lng),
            label: customerLocation.label || deliveryAddress,
          }
        : undefined;

    const newOrder = await orderModel.create({
      orderId,
      storeId,
      clientId,
      items,
      totalAmount,
      deliveryAddress,
      customerLocation: sanitizedCustomerLocation,
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
      .populate("partnerId", "name phone vehicle");

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
      .populate("partnerId", "name phone vehicle");

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
  try {
    const { orderId } = req.params;
    const { partnerId, deliveryOTP, proofOfDeliveryImage } = req.body;

    if (!partnerId) {
      return res.status(400).json({ message: "partnerId is required" });
    }

    const normalizedDeliveryOTP = String(deliveryOTP || "").trim();
    if (!/^\d{4}$/.test(normalizedDeliveryOTP)) {
      return res.status(400).json({ message: "A valid 4-digit delivery OTP is required" });
    }

    const order = await orderModel.findById(orderId).select("+deliveryOTP");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status !== ORDER_STATUS.OUT_FOR_DELIVERY) {
      return res.status(409).json({
        message: `Order cannot be verified in ${order.status} status`,
      });
    }

    if (!order.partnerId || String(order.partnerId) !== String(partnerId)) {
      return res.status(403).json({ message: "Only the assigned partner can verify this order" });
    }

    if (order.isVerified) {
      return res.status(409).json({ message: "Order is already verified" });
    }

    if (String(order.deliveryOTP || "") !== normalizedDeliveryOTP) {
      return res.status(400).json({ message: "Invalid delivery OTP" });
    }

    const deliveryCompletionUpdates = {
      status: ORDER_STATUS.DELIVERED,
      isVerified: true,
      deliveryOTP: null,
      deliveredAt: new Date(),
      actualDelivery: new Date(),
    };

    if (proofOfDeliveryImage) {
      deliveryCompletionUpdates.proofOfDeliveryImage = proofOfDeliveryImage;
    }

    const updatedOrder = await orderModel
      .findByIdAndUpdate(orderId, deliveryCompletionUpdates, { new: true })
      .populate("partnerId", "name phone vehicle")
      .populate("storeId", "storeName address city phone");

    await syncPartnerAvailability(partnerId);
    emitOrderStatus(updatedOrder);

    return res.status(200).json({
      message: "Order verified and delivered successfully",
      order: updatedOrder,
      lifecycle: STATUS_FLOW,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Get partner orders
export const getPartnerOrders = async (req, res) => {
  try {
    const { partnerId } = req.params;

    const orders = await orderModel
      .find({ partnerId })
      .sort({ createdAt: -1 })
      .populate("storeId", "storeName phone address city");

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
      .populate("storeId", "storeName phone address city");

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
      .populate("storeId", "storeName address city phone");

    await syncPartnerAvailability(partnerId);
    emitDeliveryOTPToUser(updatedOrder, generatedDeliveryOTP);
    emitOrderStatus(updatedOrder);

    return res.status(200).json({
      message: "Job claimed successfully",
      order: updatedOrder,
      lifecycle: STATUS_FLOW,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
