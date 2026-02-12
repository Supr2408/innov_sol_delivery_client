import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
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
  verifyAndCompleteOrder,
} from "../controllers/orderController.js";

const router = express.Router();
const uploadsDirectoryPath = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadsDirectoryPath)) {
  fs.mkdirSync(uploadsDirectoryPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadsDirectoryPath);
  },
  filename: (req, file, callback) => {
    const orderId = String(req.params.orderId || "order");
    const extension = path.extname(file.originalname || "") || ".jpg";
    const uniqueFileName = `${orderId}-${Date.now()}${extension}`;
    callback(null, uniqueFileName);
  },
});

const upload = multer({ storage });

// Order routes (specific first)
router.get("/status/:storeId/:status", getOrdersByStatus);
router.get("/partners/:storeId", getDeliveryPartners);
router.get("/summary/:storeId", getStockSummary);
router.get("/user/:userId", getUserOrders);
router.get("/tracking/:userId", getUserTracking);
router.get("/partner/:partnerId", getPartnerOrders);
router.get("/jobs/open", getOpenPartnerJobs);
router.post("/:orderId/claim", claimPartnerJob);
router.post("/:orderId/verify-complete", upload.single("proofOfDeliveryImage"), verifyAndCompleteOrder);
router.put("/:orderId", updateOrderStatus);
router.post("/create/:storeId", createOrder);
router.get("/:storeId", getStoreOrders);

export default router;
