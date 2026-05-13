import { generateChatResponse } from "../services/chatService.js";

export const handleChat = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        reply: "Message is required",
      });
    }

    const result = await generateChatResponse(String(message), req.user);

    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      reply: "Server error",
    });
  }
};
