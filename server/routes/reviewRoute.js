import express from "express";
import { createReview, getUserReviews } from "../controllers/reviewController.js";

const router = express.Router();

router.post("/", createReview);
router.get("/user/:clientId", getUserReviews);

export default router;
