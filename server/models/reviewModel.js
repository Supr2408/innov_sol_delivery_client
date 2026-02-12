import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "order",
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    targetType: {
      type: String,
      enum: ["store", "partner"],
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    comment: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true },
);

reviewSchema.index({ orderId: 1, clientId: 1, targetId: 1, targetType: 1 }, { unique: true });
reviewSchema.index({ targetId: 1, targetType: 1, createdAt: -1 });

const reviewModel = mongoose.models.review || mongoose.model("review", reviewSchema);

export default reviewModel;
