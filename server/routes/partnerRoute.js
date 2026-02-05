import express from "express";
import { registerPartner, loginPartner } from "../controllers/partnerController.js";

const router = express.Router();

router.post("/register", registerPartner);
router.post("/login", loginPartner);

export default router;
