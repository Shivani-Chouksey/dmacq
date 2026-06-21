import mongoose from "mongoose";
export const VALID_TYPES = ["CREATE", "UPDATE", "DELETE", "COMMENT", "LOGIN", "CUSTOM"];
const ActivitySchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true
    },

    actorId: {
      type: String,
      required: true
    },

    actorName: {
      type: String,
      required: true
    },

    type: {
      type: String,
      required: true,
      enum: VALID_TYPES,
    },

    entityId: {
      type: String,
      required: true
    },

    metadata: {
      type: Object,
      default: {}
    },

    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
    }
  },
  {
    versionKey: false
  }
);

ActivitySchema.index({
  tenantId: 1,
  createdAt: -1
});

export const ActivityModel = mongoose.model("Activity", ActivitySchema);