import userModel from "../models/userModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    // validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please fill all the fields" });
    }
    // check if user already exists
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const saltedPassword = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, saltedPassword);
    const newUser = new userModel({ name, email, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    // validation
    if (!email || !password) {
      return res.status(400).json({ message: "Please fill all the fields" });
    }
    // check if user exists
    const existingUser = await userModel.findOne({ email });
    if (!existingUser) {
      return res.status(400).json({ message: "User does not exist" });
    }
    // compare password
    const isMatch = await bcrypt.compare(password, existingUser.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ id: existingUser._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
    res.status(200).json({
      message: "User logged in successfully",
      token,
      user: {
        id: existingUser._id,
        name: existingUser.name,
        email: existingUser.email,
        role: "user",
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const registerUserPushToken = async (req, res) => {
  try {
    const { userId } = req.params;
    const { deviceToken, platform } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const normalizedDeviceToken = String(deviceToken || "").trim();
    if (!normalizedDeviceToken) {
      return res.status(400).json({ message: "deviceToken is required" });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const existingTokenIndex = (user.deviceTokens || []).findIndex(
      (entry) => String(entry.token) === normalizedDeviceToken,
    );

    if (existingTokenIndex >= 0) {
      user.deviceTokens[existingTokenIndex].platform = platform || user.deviceTokens[existingTokenIndex].platform;
      user.deviceTokens[existingTokenIndex].updatedAt = new Date();
    } else {
      user.deviceTokens.push({
        token: normalizedDeviceToken,
        platform: platform || "web",
        updatedAt: new Date(),
      });
    }

    await user.save();

    return res.status(200).json({
      message: "Push token registered successfully",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
