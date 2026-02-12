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

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: undefined,
      },
      updatedAt: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true }
);

partnerSchema.index({ location: "2dsphere" });

const partnerModel = mongoose.models.partner || mongoose.model("partner", partnerSchema);

export default partnerModel;
