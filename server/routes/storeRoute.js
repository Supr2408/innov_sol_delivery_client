import express from "express";
import { registerStore, loginStore, getAllStores } from "../controllers/storeController.js";

const router = express.Router();

router.post("/register", registerStore);
router.post("/login", loginStore);
router.get("/all", getAllStores);

export default router;
