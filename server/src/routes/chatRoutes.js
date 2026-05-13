/**
 * Chat Routes
 * Endpoints for the career chatbot system
 */

import express from "express";
import { handleChat } from "../controllers/chatController.js";

const router = express.Router();

/**
 * POST /api/chat - Send a message to the career chatbot
 * Body: { message: string }
 * Response: { success: boolean, intent: string, reply: string }
 */
router.post("/", handleChat);

export default router;
