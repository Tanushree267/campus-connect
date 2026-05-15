import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "job_opening",
        "internship_opening",
        "referral_opportunity",
        "event",
        "internship_achievement",
        "hackathon_achievement",
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    company: {
      type: String,
      required: true,
    },

    domain: {
      type: String,
      required: true,
    },

    visibility: {
      type: String,
      enum: ["public", "alumni_only", "students_only"],
      default: "public",
    },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
    },

    imageUrl: {
      type: String,
      default: null,
    },

    flagged: {
      type: Boolean,
      default: false,
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    engagement: {
      views: {
        type: Number,
        default: 0,
      },

      applications: {
        type: Number,
        default: 0,
      },
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

/* =========================
   INDEXES
========================= */

postSchema.index({ authorId: 1 });
postSchema.index({ type: 1 });
postSchema.index({ status: 1 });
postSchema.index({ visibility: 1 });
postSchema.index({ expiresAt: 1 });
postSchema.index({ createdAt: -1 });

postSchema.index({
  type: 1,
  status: 1,
  visibility: 1,
  createdAt: -1,
});

/* =========================
   METADATA VALIDATION
========================= */

postSchema.pre("save", function (next) {
  const post = this;

  /* =========================
     REQUIRED FIELDS BY TYPE
  ========================= */

  const requiredFields = {
    job_opening: [
      "roleTitle",
      "location",
      "applicationLink",
    ],

    internship_opening: [
      "internshipDuration",
      "mode",
      "applicationLink",
    ],

    referral_opportunity: [
      "roleTitle",
    ],

    event: [
      "eventCategory",
      "organizer",
      "eventDate",
      "eventMode",
      "registrationLink",
    ],
  };

  /* =========================
     ENUM VALIDATIONS
  ========================= */

  const enumValidations = {
    applicationMethod: [
      "external_link",
      "platform_apply",
      "email",
    ],

    mode: [
      "remote",
      "hybrid",
      "on-site",
    ],

    eventMode: [
      "online",
      "offline",
      "hybrid",
    ],

    stipendStatus: [
      "stipend",
      "no_stipend",
    ],
  };

  /* =========================
     SKIP FOR ACHIEVEMENTS
  ========================= */

  const fields = requiredFields[post.type];

  if (!fields) {
    return next();
  }

  /* =========================
     REQUIRED FIELD CHECK
  ========================= */

  for (const field of fields) {
    if (!post.metadata[field]) {
      return next(
        new Error(
          `Missing required metadata field: ${field} for type ${post.type}`
        )
      );
    }
  }

  /* =========================
     ENUM VALUE CHECK
  ========================= */

  for (const [field, values] of Object.entries(enumValidations)) {
    if (
      post.metadata[field] &&
      !values.includes(post.metadata[field])
    ) {
      return next(
        new Error(
          `Invalid ${field}: ${post.metadata[field]}`
        )
      );
    }
  }

  /* =========================
     JOB OPENING VALIDATIONS
  ========================= */

  if (
    post.type === "job_opening" &&
    post.metadata.salaryRange
  ) {
    const sr = post.metadata.salaryRange;

    if (
      typeof sr.min !== "number" ||
      typeof sr.max !== "number"
    ) {
      return next(
        new Error(
          "salaryRange min/max must be numbers"
        )
      );
    }
  }

  /* =========================
     REFERRAL DEFAULT SLOTS
  ========================= */

  if (
    post.type === "referral_opportunity" &&
    post.metadata.slotsRemaining === undefined
  ) {
    post.metadata.slotsRemaining =
      post.metadata.referralSlots || 1;
  }

  /* =========================
     ELIGIBLE BATCH VALIDATION
  ========================= */

  if (
    post.metadata.eligibleBatches &&
    Array.isArray(post.metadata.eligibleBatches)
  ) {
    const validBatches =
      post.metadata.eligibleBatches.every(
        (batch) =>
          typeof batch === "number" &&
          batch >= 2021 &&
          batch <= 2027
      );

    if (!validBatches) {
      return next(
        new Error(
          "eligibleBatches must be an array of numbers between 2021 and 2027"
        )
      );
    }
  }

  /* =========================
     EVENT DATE VALIDATION
  ========================= */

  if (
    post.type === "event" &&
    post.metadata.eventDate
  ) {
    const eventDate = new Date(post.metadata.eventDate);

    if (isNaN(eventDate.getTime())) {
      return next(
        new Error("Invalid eventDate format")
      );
    }
  }

  /* =========================
     EXPIRES AT VALIDATION
  ========================= */

  if (post.expiresAt) {
    const expiresDate = new Date(post.expiresAt);

    if (isNaN(expiresDate.getTime())) {
      return next(
        new Error("Invalid expiresAt date")
      );
    }
  }

  next();
});

/* =========================
   MODEL EXPORT
========================= */

const Post = mongoose.model("Post", postSchema);

export default Post;