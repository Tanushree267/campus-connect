import express from "express";
import { body } from "express-validator";
import {
  analyzeAts,
  createReferralRequest,
  getSentRequests,
  getReceivedRequests,
  updateRequestStatus,
  uploadReferralResume,
} from "../controllers/referralController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// POST /api/referrals/resume - Upload a referral resume PDF
router.post("/resume", uploadReferralResume);

// POST /api/referrals - Create a new referral request
router.post(
  "/",
  [
    body("referralPostId").isMongoId().withMessage("Invalid post ID"),
    body("resumeUrl")
      .isString()
      .withMessage("Resume URL is required")
      .bail()
      .custom((value) => {
        const isPdf = value.toLowerCase().endsWith(".pdf");
        const isAbsoluteUrl = /^https?:\/\//i.test(value);
        const isRelativePath = value.startsWith("/");
        return isPdf && (isAbsoluteUrl || isRelativePath);
      })
      .withMessage("Resume must be a PDF URL or local path"),
    body("motivation").optional().isLength({ max: 250 }).withMessage("Motivation too long"),
    body("linkedinUrl").optional({ checkFalsy: true }).isURL().withMessage("Invalid LinkedIn URL"),
  ],
  createReferralRequest
);

// GET /api/referrals/sent - Get requests sent by current user
router.get("/sent", getSentRequests);

// GET /api/referrals/received - Get requests received by current alumni
router.get("/received", getReceivedRequests);

// POST /api/referrals/:id/analyze-ats - Analyze resume against referral post
router.post("/:id/analyze-ats", analyzeAts);

// PATCH /api/referrals/:id/status - Update request status
router.patch("/:id/status", updateRequestStatus);

export default router;
