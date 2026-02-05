import adminModel from "../models/adminModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


export const registerAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    // validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please fill all the fields" });
    }
    // check if user already exists
    const existingAdmin = await adminModel.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    const saltedPassword = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, saltedPassword);
    const newAdmin = new adminModel({ name, email, password: hashedPassword });
    await newAdmin.save();
    res.status(201).json({ message: "Admin registered successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    // validation
    if (!email || !password) {
      return res.status(400).json({ message: "Please fill all the fields" });
    }
    // check if user exists
    const existingAdmin = await adminModel.findOne({ email });
    if (!existingAdmin) {
      return res.status(400).json({ message: "Admin does not exist" });
    }
    // compare password
    const isMatch = await bcrypt.compare(password, existingAdmin.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ id: existingAdmin._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
    res.status(200).json({
      message: "Admin logged in successfully",
      token,
      user: {
        id: existingAdmin._id,
        name: existingAdmin.name,
        email: existingAdmin.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
