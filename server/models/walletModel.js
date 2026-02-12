import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    walletType: {
      type: String,
      enum: ["partner", "store"],
      required: true,
    },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "partner",
      default: null,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "store",
      default: null,
    },
    totalBalance: {
      type: Number,
      default: 0,
    },
    totalEarned: {
      type: Number,
      default: 0,
    },
    dailyEarnings: {
      type: Map,
      of: Number,
      default: {},
    },
    lastCreditedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

walletSchema.index(
  { walletType: 1, partnerId: 1 },
  { unique: true, partialFilterExpression: { walletType: "partner" } },
);
walletSchema.index(
  { walletType: 1, storeId: 1 },
  { unique: true, partialFilterExpression: { walletType: "store" } },
);

const walletModel = mongoose.models.wallet || mongoose.model("wallet", walletSchema);

export default walletModel;
