import express from "express";
import { registerStore, loginStore } from "../controllers/storeController.js";

const router = express.Router();

router.post("/register", registerStore);
router.post("/login", loginStore);

export default router;
