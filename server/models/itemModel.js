import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "store",
      required: true,
    },

    itemName: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      default: "",
    },

    price: {
      type: Number,
      required: true,
    },

    stock: {
      type: Number,
      required: true,
      default: 0,
    },

    category: {
      type: String,
      default: "General",
    },

    sku: {
      type: String,
      required: true,
      unique: true,
    },

    image: {
      type: String,
      default: "",
    },

    specifications: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

const itemModel = mongoose.models.item || mongoose.model("item", itemSchema);

export default itemModel;
