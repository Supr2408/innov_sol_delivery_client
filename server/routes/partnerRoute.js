import express from "express";
import {
  registerPartner,
  loginPartner,
  getAllPartners,
} from "../controllers/partnerController.js";

const router = express.Router();

router.post("/register", registerPartner);
router.post("/login", loginPartner);
router.get("/all", getAllPartners);

export default router;
