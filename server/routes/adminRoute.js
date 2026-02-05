import express from "express";
import { registerAdmin,loginAdmin } from "../controllers/adminController.js";

const router = express.Router();

// Sample route for admin registration
router.post("/register", registerAdmin);
router.post("/login",loginAdmin);

export default router;