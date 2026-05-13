import mongoose from "mongoose";

const referralRequestSchema = new mongoose.Schema(
  {
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requesterRole: {
      type: String,
      enum: ["student", "alumni", "admin"],
      required: true,
    },
    alumniId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    referralPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    companySnapshot: {
      type: String,
      required: true,
    },
    roleSnapshot: {
      type: String,
      required: true,
    },
    motivation: {
      type: String,
      maxlength: 250,
      default: "",
    },
    linkedinUrl: {
      type: String,
      default: "",
    },
    resumeUrl: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    statusUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    atsScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    atsReport: {
      summary: { type: String, default: "" },
      matchedSkills: { type: [String], default: [] },
      missingSkills: { type: [String], default: [] },
      strengths: { type: [String], default: [] },
      weaknesses: { type: [String], default: [] },
      recommendation: { type: String, default: "" },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate requests per post per user
referralRequestSchema.index({ requesterId: 1, referralPostId: 1 }, { unique: true });

export default mongoose.model("ReferralRequest", referralRequestSchema);
