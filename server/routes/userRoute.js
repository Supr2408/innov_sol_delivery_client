import express from "express";
import { loginUser, registerUser } from "../controllers/userController.js";

const router = express.Router();

// Sample route for user registration
router.post("/register", registerUser);
router.post("/login",loginUser);

export default router;