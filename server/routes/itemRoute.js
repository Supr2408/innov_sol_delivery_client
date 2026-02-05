import express from "express";
import multer from "multer";
import {
  addItem,
  getStoreItems,
  updateItem,
  deleteItem,
  importItemsFromExcel,
} from "../controllers/itemController.js";

const router = express.Router();

// Setup multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Item routes - More specific routes first!
router.post("/import/:storeId", upload.single("file"), importItemsFromExcel);
router.post("/add/:storeId", addItem);
router.get("/:storeId", getStoreItems);
router.put("/:itemId", updateItem);
router.delete("/:itemId", deleteItem);

export default router;
