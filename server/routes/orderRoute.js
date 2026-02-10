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
  getPartnerOrders,
  getOpenPartnerJobs,
  claimPartnerJob,
} from "../controllers/orderController.js";

const router = express.Router();

// Order routes (specific first)
router.get("/status/:storeId/:status", getOrdersByStatus);
router.get("/partners/:storeId", getDeliveryPartners);
router.get("/summary/:storeId", getStockSummary);
router.get("/user/:userId", getUserOrders);
router.get("/tracking/:userId", getUserTracking);
router.get("/partner/:partnerId", getPartnerOrders);
router.get("/jobs/open", getOpenPartnerJobs);
router.post("/:orderId/claim", claimPartnerJob);
router.put("/:orderId", updateOrderStatus);
router.post("/create/:storeId", createOrder);
router.get("/:storeId", getStoreOrders);

export default router;
