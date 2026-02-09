import storeModel from "../models/storeModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const registerStore = async (req, res) => {
  try {
    const { storeName, email, password, phone, address, city } = req.body;
    // validation
    if (!storeName || !email || !password || !phone || !address || !city) {
      return res.status(400).json({ message: "Please fill all the fields" });
    }
    // check if store already exists
    const existingStore = await storeModel.findOne({ email });
    if (existingStore) {
      return res.status(400).json({ message: "Store already exists" });
    }

    const saltedPassword = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, saltedPassword);
    const newStore = new storeModel({
      storeName,
      email,
      password: hashedPassword,
      phone,
      address,
      city,
    });
    await newStore.save();
    res.status(201).json({ message: "Store registered successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const loginStore = async (req, res) => {
  try {
    const { email, password } = req.body;
    // validation
    if (!email || !password) {
      return res.status(400).json({ message: "Please fill all the fields" });
    }
    // check if store exists
    const existingStore = await storeModel.findOne({ email });
    if (!existingStore) {
      return res.status(400).json({ message: "Store does not exist" });
    }
    // compare password
    const isMatch = await bcrypt.compare(password, existingStore.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ id: existingStore._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
    res.status(200).json({
      message: "Store logged in successfully",
      token,
      user: {
        id: existingStore._id,
        storeName: existingStore.storeName,
        email: existingStore.email,
        phone: existingStore.phone,
        city: existingStore.city,
        address: existingStore.address,
        role: "store",
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all stores
export const getAllStores = async (req, res) => {
  try {
    const stores = await storeModel.find().select("_id storeName email phone city address");
    res.status(200).json({
      message: "Stores retrieved successfully",
      stores,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
