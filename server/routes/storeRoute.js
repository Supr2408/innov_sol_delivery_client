import express from "express";
import {
  registerStore,
  loginStore,
  getAllStores,
  updateStoreLocation,
} from "../controllers/storeController.js";

const router = express.Router();

router.post("/register", registerStore);
router.post("/login", loginStore);
router.get("/all", getAllStores);
router.put("/:storeId/location", updateStoreLocation);

export default router;
