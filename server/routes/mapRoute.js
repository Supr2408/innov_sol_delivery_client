import express from "express";
import { getRoutePath } from "../controllers/mapController.js";

const router = express.Router();

router.get("/route", getRoutePath);

export default router;

