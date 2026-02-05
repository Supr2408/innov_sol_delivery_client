import mongoose from "mongoose";

const partnerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },

    vehicle: {
      type: String,
      enum: ["bike", "car", "van"],
      required: true,
    },

    role: {
      type: String,
      default: "partner",
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const partnerModel = mongoose.models.partner || mongoose.model("partner", partnerSchema);

export default partnerModel;
