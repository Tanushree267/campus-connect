import { detectIntent } from "../utils/intentDetector.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const getGroqModel = () => process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const getRagServiceUrl = () => process.env.RAG_SERVICE_URL || "http://localhost:8000";
const getRagTopK = () => Number(process.env.RAG_TOP_K || 3);

const RESPONSE_BY_INTENT = {
  resume:
    "## Resume help\nStart with a clear headline, then tighten each experience bullet around impact: action, scope, and result. Add role-specific keywords from the job description, keep formatting simple, and place your strongest projects near the top.",
  interview:
    "## Interview prep\nPractice a short intro, revise 3 strong project stories, and prepare STAR answers for teamwork, conflict, failure, and ownership. For technical rounds, explain your approach before coding and test edge cases out loud.",
  career:
    "## Career guidance\nPick one target role, list the skills it repeatedly asks for, and build 2 portfolio projects that prove those skills. Then start applying while improving from feedback instead of waiting until everything feels perfect.",
  skills:
    "## Skill suggestions\nFor most software roles, strengthen DSA basics, Git, APIs, databases, and one frontend or backend framework. Add cloud fundamentals and testing once your core stack is comfortable.",
  roadmap:
    "## Learning roadmap\nUse a 4-week cycle: learn the basics, build a small project, get feedback, then refine and publish it. Repeat with a slightly harder project tied to your target role.",
  alumni_guidance:
    "## Alumni and referrals\nSend a short, specific message: who you are, why you are reaching out, the role you want, and one link to your resume or portfolio. Ask for advice first; referrals usually follow better from a real conversation.",
  platform_help:
    "## Platform guide\nUse discovery to find alumni, send connection requests with a clear purpose, track referrals from your dashboard, and keep your profile updated so alumni can quickly understand your background.",
  technical:
    "## Technical help\nBreak the problem into inputs, outputs, constraints, and edge cases. If you share the exact topic or error, I can help you debug it step by step.",
  unknown:
    "I can help with resumes, interviews, skills, career roadmaps, alumni outreach, referrals, and platform guidance. Try asking something like: \"Improve my resume\" or \"Prepare me for an interview\".",
};

const STRUCTURED_INTENTS = new Set([
  "resume",
  "interview",
  "career",
  "skills",
  "roadmap",
  "alumni_guidance",
]);

const getUserContext = (user) => {
  if (!user) return "";

  const parts = [];
  if (user.name) parts.push(user.name);
  if (user.role) parts.push(user.role);
  if (user.domain) parts.push(user.domain);
  if (Array.isArray(user.skills) && user.skills.length > 0) {
    parts.push(`skills: ${user.skills.slice(0, 5).join(", ")}`);
  }

  return parts.length ? `\n\nContext I considered: ${parts.join(" | ")}.` : "";
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

export const getRelevantContext = async (message) => {
  try {
    const response = await fetchWithTimeout(`${getRagServiceUrl()}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: message,
        top_k: getRagTopK(),
      }),
    }, 8000);

    if (!response.ok) {
      console.warn(`RAG search failed with status ${response.status}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data.results) ? data.results.filter(Boolean) : [];
  } catch (error) {
    console.warn("RAG service unavailable:", error.message);
    return [];
  }
};

const buildSystemPrompt = ({ intent, context, user }) => {
  const retrievedContext = context.length
    ? context.map((item, index) => `${index + 1}. ${item}`).join("\n")
    : "No retrieved CampusConnect context was available.";

  return [
    "You are the CampusConnect career assistant.",
    "Use retrieved CampusConnect context when it is relevant.",
    "If the context does not answer the question, say what you can infer and ask for the missing detail.",
    "Keep answers concise, practical, and formatted for a chat UI.",
    `Detected intent: ${intent}.`,
    `User context: ${getUserContext(user).replace(/\n/g, " ").trim() || "none"}`,
    "Retrieved CampusConnect context:",
    retrievedContext,
  ].join("\n");
};

const callGroq = async ({ message, intent, context, user }) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const response = await fetchWithTimeout(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: getGroqModel(),
      temperature: 0.3,
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt({ intent, context, user }),
        },
        {
          role: "user",
          content: message,
        },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.error?.message || `Groq request failed with status ${response.status}`;
    throw new Error(message);
  }

  const reply = data.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error("Groq returned an empty response");
  }

  return reply;
};

const buildFallbackReply = (intent, context, user) => {
  const baseReply = RESPONSE_BY_INTENT[intent] || RESPONSE_BY_INTENT.unknown;
  const contextReply = context.length
    ? `\n\n## Relevant CampusConnect context\n${context.map(item => `- ${item}`).join("\n")}`
    : "";

  return `${baseReply}${contextReply}${getUserContext(user)}`;
};

export const generateChatResponse = async (message, user) => {
  const intent = detectIntent(message);
  const context = await getRelevantContext(message);

  if (STRUCTURED_INTENTS.has(intent) && !process.env.GROQ_API_KEY) {
    return {
      success: true,
      intent,
      source: "structured",
      context,
      reply: buildFallbackReply(intent, context, user),
    };
  }

  try {
    const reply = await callGroq({
      message,
      intent,
      context,
      user,
    });

    return {
      success: true,
      intent,
      source: "groq_rag",
      context,
      reply,
    };
  } catch (error) {
    console.warn("Groq generation failed:", error.message);

    return {
      success: true,
      intent,
      source: "fallback",
      context,
      reply: buildFallbackReply(intent, context, user),
    };
  }
};
