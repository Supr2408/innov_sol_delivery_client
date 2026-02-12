import orderModel from "../models/orderModel.js";
import reviewModel from "../models/reviewModel.js";

const ORDER_STATUS_DELIVERED = "delivered";

const resolveTargetType = (order, targetId, targetType) => {
  const normalizedTargetType = String(targetType || "").trim().toLowerCase();
  if (normalizedTargetType === "store" || normalizedTargetType === "partner") {
    return normalizedTargetType;
  }

  if (String(order.storeId || "") === String(targetId || "")) {
    return "store";
  }

  if (String(order.partnerId || "") === String(targetId || "")) {
    return "partner";
  }

  return "";
};

export const createReview = async (req, res) => {
  try {
    const { orderId, clientId, targetId, targetType, rating, comment } = req.body;

    if (!orderId || !clientId || !targetId) {
      return res.status(400).json({ message: "orderId, clientId, and targetId are required" });
    }

    const normalizedRating = Number(rating);
    if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      return res.status(400).json({ message: "rating must be an integer between 1 and 5" });
    }

    const order = await orderModel.findById(orderId).select("_id clientId storeId partnerId status");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (String(order.clientId) !== String(clientId)) {
      return res.status(403).json({ message: "Only the order owner can submit this review" });
    }

    if (order.status !== ORDER_STATUS_DELIVERED) {
      return res.status(409).json({ message: "Reviews can only be submitted after delivery" });
    }

    const normalizedTargetType = resolveTargetType(order, targetId, targetType);
    if (!normalizedTargetType) {
      return res.status(400).json({ message: "targetId must be the order store or assigned partner" });
    }

    if (normalizedTargetType === "partner" && !order.partnerId) {
      return res.status(400).json({ message: "This order has no assigned partner to review" });
    }

    const existingReview = await reviewModel.findOne({
      orderId,
      clientId,
      targetId,
      targetType: normalizedTargetType,
    });
    if (existingReview) {
      return res.status(409).json({ message: "You already submitted this review" });
    }

    const review = await reviewModel.create({
      orderId,
      clientId,
      targetId,
      targetType: normalizedTargetType,
      rating: normalizedRating,
      comment: String(comment || "").trim(),
    });

    return res.status(201).json({
      message: "Review submitted successfully",
      review,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getUserReviews = async (req, res) => {
  try {
    const { clientId } = req.params;

    const reviews = await reviewModel.find({ clientId }).sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Reviews retrieved successfully",
      reviews,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
