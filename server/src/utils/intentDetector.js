/**
 * Intent Detection System
 * Keyword-based intent recognition with priority ordering
 */

// Priority 1: Career-related intents (checked first)
const CAREER_KEYWORDS = {
  resume: ["resume", "cv", "profile", "improve", "update", "refine", "optimize"],
  interview: ["interview", "question", "prepare", "practice", "mock", "hiring"],
  career: ["career", "guidance", "path", "goal", "job", "role", "position"],
  skills: ["skill", "learn", "trending", "recommend", "development", "master"],
  roadmap: ["roadmap", "learning path", "plan", "timeline", "progression"],
};

// Priority 2: Network/Platform intents
const NETWORK_KEYWORDS = {
  alumni_guidance: ["alumni", "referral", "reference", "connection", "mentor"],
  platform_help: ["help", "how to", "use", "feature", "guide", "platform", "tutorial"],
};

// Priority 3: Technical detection (requires BOTH)
const TECH_KEYWORDS = [
  // Frameworks & Libraries
  "react", "hooks", "useeffect", "usestate", "nextjs", "angular", "vue",
  "express", "fastapi", "django", "flask",
  // Languages
  "javascript", "python", "java", "c++", "golang", "rust", "typescript",
  // Core Concepts
  "api", "rest", "graphql", "backend", "frontend", "database", "sql", "mongodb",
  "machine learning", "ml", "ai", "neural", "algorithm", "data structure",
];

const QUESTION_WORDS = [
  "what", "how", "why", "when", "where", "which", "explain", "describe",
  "difference", "implement", "build", "create", "design",
];

/**
 * Check if message contains tech keyword
 */
const hasTechKeyword = (msg) => {
  return TECH_KEYWORDS.some((keyword) => msg.includes(keyword));
};

/**
 * Check if message contains question word
 */
const hasQuestionWord = (msg) => {
  return QUESTION_WORDS.some((word) => msg.includes(word));
};

/**
 * Detect user intent from message
 * Priority: Career → Network → Technical → Unknown
 * 
 * @param {string} message - User's chat message
 * @returns {string} - Detected intent
 */
export const detectIntent = (message) => {
  try {
    const normalized = message?.toLowerCase().trim() || "";

    if (!normalized) {
      return "unknown";
    }

    const isPlatformQuestion = ["campusconnect", "platform"].some((keyword) =>
      normalized.includes(keyword)
    );

    if (isPlatformQuestion && ["profile", "profiles", "feature", "guide", "use"].some((keyword) =>
      normalized.includes(keyword)
    )) {
      return "platform_help";
    }

    if (isPlatformQuestion && ["alumni", "referral", "connection", "mentor"].some((keyword) =>
      normalized.includes(keyword)
    )) {
      return "alumni_guidance";
    }

    // Priority 1: Check career intents first
    for (const [intent, keywords] of Object.entries(CAREER_KEYWORDS)) {
      if (keywords.some((keyword) => normalized.includes(keyword))) {
        return intent;
      }
    }

    // Priority 2: Check network intents
    for (const [intent, keywords] of Object.entries(NETWORK_KEYWORDS)) {
      if (keywords.some((keyword) => normalized.includes(keyword))) {
        return intent;
      }
    }

    // Priority 3: Check technical (requires tech keyword AND question word OR multi-word)
    if (hasTechKeyword(normalized)) {
      const wordCount = normalized.split(" ").length;
      const hasQuestion = hasQuestionWord(normalized);
      
      // Tech intent if: (tech keyword) AND (has question word OR 2+ words)
      if (hasQuestion || wordCount >= 2) {
        return "technical";
      }
    }

    // Priority 4: Fallback
    return "unknown";
  } catch (error) {
    console.error("Intent detection error:", error);
    return "unknown";
  }
};

export default { detectIntent };
