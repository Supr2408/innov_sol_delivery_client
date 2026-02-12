import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      required: true,
    },

    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "store",
      required: true,
    },

    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "partner",
      default: null,
    },

    items: [
      {
        itemId: mongoose.Schema.Types.ObjectId,
        itemName: String,
        quantity: Number,
        price: Number,
        subtotal: Number,
      },
    ],

    baseSubtotal: {
      type: Number,
      default: 0,
    },

    deliveryFee: {
      type: Number,
      default: 0,
    },

    platformFee: {
      type: Number,
      default: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "in_transit", "delivered", "cancelled"],
      default: "pending",
    },

    deliveryOTP: {
      type: String,
      default: null,
      select: false,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    deliveryAddress: {
      type: String,
      required: true,
    },
    customerLocation: {
      lat: Number,
      lng: Number,
      label: String,
    },
    storeLocation: {
      lat: Number,
      lng: Number,
      label: String,
    },
    partnerCurrentLocation: {
      lat: Number,
      lng: Number,
      updatedAt: Date,
    },

    clientName: String,
    clientPhone: String,

    partnerName: String,
    partnerPhone: String,
    partnerVehicle: String,

    estimatedDelivery: Date,
    actualDelivery: Date,

    shippedAt: Date,
    deliveredAt: Date,
    proofOfDeliveryImage: String,
    isWalletCredited: {
      type: Boolean,
      default: false,
    },
    storeWalletCreditAmount: {
      type: Number,
      default: 0,
    },
    partnerWalletCreditAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

orderSchema.index({ partnerId: 1 });
orderSchema.index({ clientId: 1 });
orderSchema.index({ storeId: 1 });

const orderModel = mongoose.models.order || mongoose.model("order", orderSchema);

export default orderModel;
