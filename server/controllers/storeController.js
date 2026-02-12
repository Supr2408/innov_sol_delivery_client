import storeModel from "../models/storeModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const registerStore = async (req, res) => {
  try {
    const { storeName, email, password, phone, address, city, location } = req.body;
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
    const hasLocation =
      Number.isFinite(Number(location?.lat)) && Number.isFinite(Number(location?.lng));

    const newStore = new storeModel({
      storeName,
      email,
      password: hashedPassword,
      phone,
      address,
      city,
      location: hasLocation
        ? {
            type: "Point",
            coordinates: [Number(location.lng), Number(location.lat)],
          }
        : undefined,
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
        location:
          Array.isArray(existingStore.location?.coordinates) &&
          existingStore.location.coordinates.length === 2
            ? {
                lat: Number(existingStore.location.coordinates[1]),
                lng: Number(existingStore.location.coordinates[0]),
              }
            : null,
        role: "store",
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateStoreLocation = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { location, address, city } = req.body;

    if (!storeId) {
      return res.status(400).json({ message: "storeId is required" });
    }

    const lat = Number(location?.lat);
    const lng = Number(location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: "Valid location coordinates are required" });
    }

    const updates = {
      location: {
        type: "Point",
        coordinates: [lng, lat],
      },
    };

    if (typeof address === "string" && address.trim()) {
      updates.address = address.trim();
    }

    if (typeof city === "string" && city.trim()) {
      updates.city = city.trim();
    }

    const updatedStore = await storeModel.findByIdAndUpdate(storeId, updates, { new: true });
    if (!updatedStore) {
      return res.status(404).json({ message: "Store not found" });
    }

    return res.status(200).json({
      message: "Store location updated successfully",
      store: {
        id: updatedStore._id,
        storeName: updatedStore.storeName,
        email: updatedStore.email,
        phone: updatedStore.phone,
        city: updatedStore.city,
        address: updatedStore.address,
        location:
          Array.isArray(updatedStore.location?.coordinates) &&
          updatedStore.location.coordinates.length === 2
            ? {
                lat: Number(updatedStore.location.coordinates[1]),
                lng: Number(updatedStore.location.coordinates[0]),
              }
            : null,
        role: "store",
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Get all stores
export const getAllStores = async (req, res) => {
  try {
    const stores = await storeModel
      .find()
      .select("_id storeName email phone city address location");
    res.status(200).json({
      message: "Stores retrieved successfully",
      stores,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
