import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import connectionRoutes from "./routes/connectionRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import referralRoutes from "./routes/referralRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json({ limit: "7mb" }));
app.use(express.urlencoded({ extended: true, limit: "7mb" }));
const resumeUploadDir = path.resolve(__dirname, "../uploads/resumes");
app.use("/resumes", express.static(resumeUploadDir));
app.get("/resumes/:fileName", (req, res) => {
  const fileName = path.basename(req.params.fileName);
  const filePath = path.join(resumeUploadDir, fileName);

  res.sendFile(filePath, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
    },
  }, (error) => {
    if (error && !res.headersSent) {
      res.status(error.statusCode || 404).json({
        success: false,
        message: "Resume file not found",
      });
    }
  });
});

// Connect to MongoDB
connectDB();

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Auth routes
app.use("/api/auth", authRoutes);

// User routes
app.use("/api/users", userRoutes);

// Profile routes (me)
app.use("/api", profileRoutes);

// Connection routes
app.use("/api/connections", connectionRoutes);

// Notification routes
app.use("/api/notifications", notificationRoutes);

// Post routes
app.use("/api/posts", postRoutes);

// Referral routes
app.use("/api/referrals", referralRoutes);

// Chatbot routes
app.use("/api/chat", chatRoutes);
app.use("/chat", chatRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
