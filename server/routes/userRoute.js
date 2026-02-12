import express from "express";
import { loginUser, registerUser, registerUserPushToken } from "../controllers/userController.js";

const router = express.Router();

// Sample route for user registration
router.post("/register", registerUser);
router.post("/login",loginUser);
router.post("/:userId/push-token", registerUserPushToken);

export default router;
