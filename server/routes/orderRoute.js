import express from "express";
import {
  getStoreOrders,
  getOrdersByStatus,
  getDeliveryPartners,
  getStockSummary,
  updateOrderStatus,
  createOrder,
  getUserOrders,
  getUserTracking,
} from "../controllers/orderController.js";

const router = express.Router();

// Order routes
router.get("/:storeId", getStoreOrders);
router.get("/status/:storeId/:status", getOrdersByStatus);
router.get("/partners/:storeId", getDeliveryPartners);
router.get("/summary/:storeId", getStockSummary);
router.get("/user/:userId", getUserOrders);
router.get("/tracking/:userId", getUserTracking);
router.put("/:orderId", updateOrderStatus);
router.post("/create/:storeId", createOrder);

export default router;
