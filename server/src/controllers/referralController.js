import ReferralRequest from "../models/ReferralRequest.js";
import Post from "../models/Post.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { validationResult } from "express-validator";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { PDFParse } from "pdf-parse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const resumeUploadDir = path.resolve(__dirname, "../../uploads/resumes");
const ATS_JSON_SHAPE = {
  summary: "",
  matchedSkills: [],
  missingSkills: [],
  strengths: [],
  weaknesses: [],
  recommendation: "",
};

const activePostFilter = () => ({
  $or: [
    { expiresAt: null },
    { expiresAt: { $exists: false } },
    { expiresAt: { $gte: new Date() } },
  ],
});

const serializeUser = (user) => {
  if (!user) return null;

  return {
    id: user._id?.toString?.() || user.id,
    _id: user._id,
    name: user.name,
    avatar: user.avatar || "",
    role: user.role,
    email: user.email,
    company: user.company,
    registrationNumber: user.registrationNumber,
  };
};

const serializePost = (post) => {
  if (!post) return null;

  return {
    id: post._id?.toString?.() || post.id,
    _id: post._id,
    title: post.title,
    company: post.company,
  };
};

const hasCachedAtsReport = (request) =>
  typeof request.atsScore === "number" &&
  request.atsReport &&
  typeof request.atsReport.summary === "string";

const serializeAtsResult = (request) => ({
  atsScore: Math.max(0, Math.min(100, Math.round(Number(request.atsScore) || 0))),
  summary: request.atsReport?.summary || "",
  matchedSkills: Array.isArray(request.atsReport?.matchedSkills) ? request.atsReport.matchedSkills : [],
  missingSkills: Array.isArray(request.atsReport?.missingSkills) ? request.atsReport.missingSkills : [],
  strengths: Array.isArray(request.atsReport?.strengths) ? request.atsReport.strengths : [],
  weaknesses: Array.isArray(request.atsReport?.weaknesses) ? request.atsReport.weaknesses : [],
  recommendation: request.atsReport?.recommendation || "",
});

const resolveResumePath = (resumeUrl) => {
  const rawUrl = String(resumeUrl || "").trim();
  let pathname = rawUrl;

  if (/^https?:\/\//i.test(rawUrl)) {
    pathname = new URL(rawUrl).pathname;
  }

  if (!pathname.startsWith("/resumes/")) {
    throw new Error("Only locally uploaded referral resumes can be analyzed");
  }

  const fileName = path.basename(pathname);
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    throw new Error("Resume must be a PDF file");
  }

  return path.join(resumeUploadDir, fileName);
};

const buildJobText = (post) => {
  const metadataEntries = Object.entries(post.metadata || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`);

  return [
    `Title: ${post.title}`,
    `Company: ${post.company}`,
    `Domain: ${post.domain}`,
    `Description: ${post.description}`,
    metadataEntries.length ? `Additional details: ${metadataEntries.join("; ")}` : "",
  ].filter(Boolean).join("\n");
};

const extractJsonObject = (content) => {
  const text = String(content || "").trim();
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI response did not contain a JSON object");
  }

  return JSON.parse(candidate.slice(start, end + 1));
};

const normalizeStringArray = (value) =>
  Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 20)
    : [];

const normalizeAtsAnalysis = (analysis) => ({
  atsScore: Math.max(0, Math.min(100, Math.round(Number(analysis.atsScore) || 0))),
  summary: String(analysis.summary || "").trim(),
  matchedSkills: normalizeStringArray(analysis.matchedSkills),
  missingSkills: normalizeStringArray(analysis.missingSkills),
  strengths: normalizeStringArray(analysis.strengths),
  weaknesses: normalizeStringArray(analysis.weaknesses),
  recommendation: String(analysis.recommendation || "").trim(),
});

const buildAtsPrompt = (resumeText, jobText) => `You are an expert ATS (Applicant Tracking System) evaluator.

Compare the following resume and job description.

Return ONLY valid JSON:

{
  "atsScore": number (0-100),
  "summary": string,
  "matchedSkills": string[],
  "missingSkills": string[],
  "strengths": string[],
  "weaknesses": string[],
  "recommendation": string
}

Scoring rules:
- Skills relevance: 40%
- Experience relevance: 30%
- Education relevance: 10%
- Project relevance: 20%

Resume:
"""
${resumeText}
"""

Job Description:
"""
${jobText}
"""`;

const callGroqAtsModel = async (prompt) => {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_ATS_MODEL || "llama-3.1-8b-instant",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return deterministic ATS analysis as valid JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Groq ATS analysis failed");
  }

  return data.choices?.[0]?.message?.content;
};

const callOpenAtsModel = async (prompt) => {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_ATS_MODEL || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return deterministic ATS analysis as valid JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "OpenAI ATS analysis failed");
  }

  return data.choices?.[0]?.message?.content;
};

const analyzeWithLlm = async (resumeText, jobText) => {
  const prompt = buildAtsPrompt(resumeText, jobText);
  const content = process.env.GROQ_API_KEY
    ? await callGroqAtsModel(prompt)
    : process.env.OPENAI_API_KEY
      ? await callOpenAtsModel(prompt)
      : null;

  if (!content) {
    throw new Error("Set GROQ_API_KEY or OPENAI_API_KEY to run ATS analysis");
  }

  return normalizeAtsAnalysis(extractJsonObject(content));
};

const serializeReferralRequest = (request) => {
  const plain = request.toObject ? request.toObject() : request;
  const requester = typeof plain.requesterId === "object" ? serializeUser(plain.requesterId) : null;
  const alumni = typeof plain.alumniId === "object" ? serializeUser(plain.alumniId) : null;
  const referralPost = typeof plain.referralPostId === "object" ? serializePost(plain.referralPostId) : null;

  return {
    ...plain,
    id: plain._id?.toString?.() || plain.id,
    requesterId: requester?.id || plain.requesterId?.toString?.() || plain.requesterId,
    alumniId: alumni?.id || plain.alumniId?.toString?.() || plain.alumniId,
    referralPostId: referralPost?.id || plain.referralPostId?.toString?.() || plain.referralPostId,
    requester,
    alumni,
    referralPost,
  };
};

export const analyzeAts = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await ReferralRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Referral request not found",
      });
    }

    if (req.user.role !== "alumni" || request.alumniId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the receiving alumni can run ATS analysis",
      });
    }

    if (hasCachedAtsReport(request)) {
      return res.json({
        success: true,
        cached: true,
        ...serializeAtsResult(request),
      });
    }

    const post = await Post.findById(request.referralPostId).lean();
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Referral post not found",
      });
    }

    let resumeBuffer;
    try {
      resumeBuffer = await fs.readFile(resolveResumePath(request.resumeUrl));
    } catch (fileError) {
      return res.status(400).json({
        success: false,
        message: fileError.message || "Unable to read resume PDF",
      });
    }

    const parser = new PDFParse({ data: resumeBuffer });
    let parsedResume;
    try {
      parsedResume = await parser.getText();
    } finally {
      await parser.destroy();
    }
    const resumeText = String(parsedResume.text || "").trim();
    if (!resumeText) {
      return res.status(400).json({
        success: false,
        message: "Could not extract text from resume PDF",
      });
    }

    const analysis = await analyzeWithLlm(resumeText.slice(0, 24000), buildJobText(post).slice(0, 12000));

    request.atsScore = analysis.atsScore;
    request.atsReport = {
      ...ATS_JSON_SHAPE,
      summary: analysis.summary,
      matchedSkills: analysis.matchedSkills,
      missingSkills: analysis.missingSkills,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      recommendation: analysis.recommendation,
    };
    await request.save();

    res.json({
      success: true,
      cached: false,
      ...serializeAtsResult(request),
    });
  } catch (error) {
    console.error("ATS analysis error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to analyze ATS score",
    });
  }
};

export const uploadReferralResume = async (req, res) => {
  try {
    const { fileName, fileData } = req.body;

    if (!fileName || !fileData) {
      return res.status(400).json({
        success: false,
        message: "Resume file is required",
      });
    }

    if (!fileName.toLowerCase().endsWith(".pdf")) {
      return res.status(400).json({
        success: false,
        message: "Resume must be a PDF file",
      });
    }

    const base64Data = String(fileData).replace(/^data:application\/pdf;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    if (!buffer.length || buffer.length > 5 * 1024 * 1024 || buffer.subarray(0, 4).toString() !== "%PDF") {
      return res.status(400).json({
        success: false,
        message: "Invalid PDF resume",
      });
    }

    await fs.mkdir(resumeUploadDir, { recursive: true });

    const safeUserId = req.user._id.toString();
    const storedFileName = `${safeUserId}_${Date.now()}.pdf`;
    const filePath = path.join(resumeUploadDir, storedFileName);

    await fs.writeFile(filePath, buffer);

    res.status(201).json({
      success: true,
      resumeUrl: `${req.protocol}://${req.get("host")}/resumes/${storedFileName}`,
    });
  } catch (error) {
    console.error("Resume upload error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload resume",
    });
  }
};

/**
 * Create a new referral request
 */
export const createReferralRequest = async (req, res) => {
  try {
    console.log("[referrals:create] controller entered");
    console.log("[referrals:create] payload received:", req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn("[referrals:create] validation errors:", errors.array());
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { referralPostId, motivation, linkedinUrl, resumeUrl } = req.body;
    const requesterId = req.user._id;
    const requesterRole = req.user.role;

    // Validate referral post exists and is referral type
    const post = await Post.findOne({
      _id: referralPostId,
      status: "published",
      ...activePostFilter(),
    });
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Referral post not found",
      });
    }

    if (post.type !== "referral_opportunity") {
      return res.status(400).json({
        success: false,
        message: "Post is not a referral opportunity",
      });
    }

    // Validate alumni exists
    const alumni = await User.findById(post.authorId);
    if (!alumni) {
      return res.status(404).json({
        success: false,
        message: "Alumni not found",
      });
    }

    // Prevent self-requests
    if (requesterId.toString() === alumni._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot request referral from yourself",
      });
    }

    // Check for duplicate request (handled by unique index, but check explicitly)
    const existingRequest = await ReferralRequest.findOne({
      requesterId,
      referralPostId,
    });

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message: "You have already sent a referral request for this post",
      });
    }

    // Validate resume (basic check - assume URL is provided)
    if (!resumeUrl || !resumeUrl.endsWith('.pdf')) {
      return res.status(400).json({
        success: false,
        message: "Resume must be a PDF file",
      });
    }

    // Create request
    const referralRequest = new ReferralRequest({
      requesterId,
      requesterRole,
      alumniId: alumni._id,
      referralPostId,
      companySnapshot: post.company,
      roleSnapshot: post.title, // Using title as role snapshot
      motivation: motivation || "",
      linkedinUrl: linkedinUrl || "",
      resumeUrl,
    });

    try {
      await referralRequest.save();
      console.log("[referrals:create] save success:", referralRequest._id.toString());
    } catch (saveError) {
      console.error("[referrals:create] save failure:", saveError);
      throw saveError;
    }

    Notification.create({
      userId: alumni._id,
      type: "referral_update",
      title: "New Referral Request",
      message: `${req.user.name} sent you a referral request for ${post.title} at ${post.company}`,
      linkTo: "/alumni/requests",
    }).catch((notificationError) => {
      console.error("[referrals:create] notification failure:", notificationError);
    });

    res.status(201).json({
      success: true,
      message: "Referral request submitted successfully",
      data: serializeReferralRequest(referralRequest),
    });
  } catch (error) {
    console.error("Create referral request error:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already sent a referral request for this post",
      });
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get referral requests sent by current user
 */
export const getSentRequests = async (req, res) => {
  try {
    const requests = await ReferralRequest.find({ requesterId: req.user._id })
      .populate("requesterId", "name email avatar role company registrationNumber")
      .populate("alumniId", "name email avatar role company")
      .populate("referralPostId", "title company")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: requests.map(serializeReferralRequest),
    });
  } catch (error) {
    console.error("Get sent requests error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get referral requests received by current alumni
 */
export const getReceivedRequests = async (req, res) => {
  try {
    const requests = await ReferralRequest.find({ alumniId: req.user._id })
      .populate("requesterId", "name email avatar role company registrationNumber")
      .populate("alumniId", "name email avatar role company")
      .populate("referralPostId", "title company")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: requests.map(serializeReferralRequest),
    });
  } catch (error) {
    console.error("Get received requests error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Update referral request status (accept/reject)
 */
export const updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const request = await ReferralRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Referral request not found",
      });
    }

    // Only alumni can update status
    if (request.alumniId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to update this request",
      });
    }

    request.status = status;
    request.statusUpdatedAt = new Date();
    await request.save();

    const populatedRequest = await ReferralRequest.findById(request._id)
      .populate("requesterId", "name email avatar role company registrationNumber")
      .populate("alumniId", "name email avatar role company")
      .populate("referralPostId", "title company")
      .lean();

    res.json({
      success: true,
      message: `Request ${status}`,
      data: serializeReferralRequest(populatedRequest),
    });
  } catch (error) {
    console.error("Update request status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
