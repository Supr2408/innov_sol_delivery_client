import orderModel from "../models/orderModel.js";

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

    const orders = await orderModel
      .find({ storeId, status })
      .sort({ createdAt: -1 });

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

    // Get all unique partners who have delivered items from this store
    const orders = await orderModel
      .find({
        storeId,
        partnerId: { $ne: null },
      })
      .populate("partnerId", "name email phone vehicle");

    // Extract unique partners with stats
    const partnersMap = new Map();

    orders.forEach((order) => {
      if (order.partnerId) {
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
        if (order.status === "delivered") {
          partner.totalDeliveries += 1;
          partner.totalAmount += order.totalAmount;
        }
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

    // Get all orders and calculate stock changes
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

        if (order.status === "delivered") {
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

// Update order status
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, partnerId, estimatedDelivery } = req.body;

    const order = await orderModel.findByIdAndUpdate(
      orderId,
      {
        status,
        partnerId: partnerId || order?.partnerId,
        estimatedDelivery,
        ...(status === "delivered" && { deliveredAt: new Date() }),
        ...(status === "shipped" && { shippedAt: new Date() }),
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({
      message: "Order status updated successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create order (for testing/demo)
export const createOrder = async (req, res) => {
  try {
    const { storeId, clientId, items, totalAmount, deliveryAddress, clientName, clientPhone } = req.body;

    // Generate unique order ID
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const newOrder = new orderModel({
      orderId,
      storeId,
      clientId,
      items,
      totalAmount,
      deliveryAddress,
      clientName,
      clientPhone,
      status: "pending",
    });

    await newOrder.save();

    res.status(201).json({
      message: "Order created successfully",
      order: newOrder,
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
        status: { $in: ["pending", "shipped", "in_transit"] },
      })
      .sort({ createdAt: -1 })
      .populate("partnerId", "name phone vehicle");

    res.status(200).json({
      message: "User tracking info retrieved",
      tracking,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
