import partnerModel from "../models/partnerModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const registerPartner = async (req, res) => {
  try {
    const { name, email, password, phone, vehicle } = req.body;
    // validation
    if (!name || !email || !password || !phone || !vehicle) {
      return res.status(400).json({ message: "Please fill all the fields" });
    }
    // check if partner already exists
    const existingPartner = await partnerModel.findOne({ email });
    if (existingPartner) {
      return res.status(400).json({ message: "Partner already exists" });
    }

    const saltedPassword = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, saltedPassword);
    const newPartner = new partnerModel({
      name,
      email,
      password: hashedPassword,
      phone,
      vehicle,
    });
    await newPartner.save();
    res.status(201).json({ message: "Partner registered successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const loginPartner = async (req, res) => {
  try {
    const { email, password } = req.body;
    // validation
    if (!email || !password) {
      return res.status(400).json({ message: "Please fill all the fields" });
    }
    // check if partner exists
    const existingPartner = await partnerModel.findOne({ email });
    if (!existingPartner) {
      return res.status(400).json({ message: "Partner does not exist" });
    }
    // compare password
    const isMatch = await bcrypt.compare(password, existingPartner.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ id: existingPartner._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
    res.status(200).json({
      message: "Partner logged in successfully",
      token,
      user: {
        id: existingPartner._id,
        name: existingPartner.name,
        email: existingPartner.email,
        phone: existingPartner.phone,
        vehicle: existingPartner.vehicle,
        role: "partner",
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
