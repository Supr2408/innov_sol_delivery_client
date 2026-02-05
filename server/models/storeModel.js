import mongoose from "mongoose";

const storeSchema = new mongoose.Schema(
  {
    storeName: {
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

    address: {
      type: String,
      required: true,
    },

    city: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      default: "store",
    },
  },
  { timestamps: true }
);

const storeModel = mongoose.models.store || mongoose.model("store", storeSchema);

export default storeModel;
