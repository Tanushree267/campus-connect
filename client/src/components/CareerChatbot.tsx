import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, X, Send, FileText, BriefcaseBusiness, Lightbulb, HelpCircle, Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendChatMessage } from "@/lib/api";
import type { User } from "@/lib/mock-data";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Improve my resume", icon: <FileText className="h-3.5 w-3.5" />, prompt: "Improve my resume" },
  { label: "Prepare for interview", icon: <BriefcaseBusiness className="h-3.5 w-3.5" />, prompt: "Prepare me for interview" },
  { label: "Suggest skills", icon: <Lightbulb className="h-3.5 w-3.5" />, prompt: "Suggest skills" },
  { label: "How to use platform", icon: <HelpCircle className="h-3.5 w-3.5" />, prompt: "How to use platform" },
];

interface CareerChatbotProps {
  user: User;
}

export function CareerChatbot({ user }: CareerChatbotProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: `Hi ${user.name.split(" ")[0]}\n\nI can help with resume, interview, skills, and platform guidance.`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [open, messages.length, user.name]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Reject off-topic 
const offTopicPatterns = [
  "weather",
  "joke",
  "game",
  "movie",
  "news",
  "hello",
  "hi there",
  "how are you",
  "what's up",
];

// Helper: detect off-topic messages
const isOffTopic = (msg: string) => {
  const message = msg.trim().toLowerCase();

  return offTopicPatterns.some(
    (p) => message === p || (message.length < 20 && message.includes(p))
  );
};

// ===============================
// 🚀 SEND MESSAGE FUNCTION
// ===============================

const sendMessage = async (text: string) => {
  if (!text.trim() || isTyping) return;

  const userMsg: ChatMessage = {
    id: `u-${Date.now()}`,
    role: "user",
    content: text,
    timestamp: new Date(),
  };

  // ✅ ALWAYS SHOW USER MESSAGE FIRST
  setMessages((prev) => [...prev, userMsg]);
  setInput("");

  // ===============================
  // 🚫 OFF-TOPIC CHECK
  // ===============================
  if (isOffTopic(text)) {
    const botMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: "assistant",
      content:
        "I'm your **Career Assistant** — I can only help with resume improvement, interview prep, skill suggestions, and platform guidance. Please select one of the quick actions or ask a career-related question.",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, botMsg]);
    return; // stop API call
  }

  setIsTyping(true);

  try {
    const data = await sendChatMessage(text);

    setMessages((prev) => [
      ...prev,
      {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.reply || "No response",
        timestamp: new Date(),
      },
    ]);
  } catch (error) {
    setMessages((prev) => [
      ...prev,
      {
        id: `a-${Date.now()}`,
        role: "assistant",
        content:
          error instanceof Error ? error.message : "Server error. Try again.",
        timestamp: new Date(),
      },
    ]);
  } finally {
    setIsTyping(false);
  }
};
  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isTyping) return;

    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!validTypes.includes(file.type)) {
      sendMessage("I tried to upload an invalid resume file type.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      sendMessage("My resume file was too large to upload.");
      e.target.value = "";
      return;
    }

    const uploadMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: `Uploaded resume: ${file.name}`,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, uploadMsg]);
    setInput("");
    setIsTyping(true);

    sendChatMessage(`I uploaded a resume named ${file.name}. Give resume improvement guidance for my ${user.domain} profile.`)
      .then(data => {
        setMessages(prev => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: data.reply || "No response",
            timestamp: new Date(),
          },
        ]);
      })
      .catch(error => {
        setMessages(prev => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: error instanceof Error ? error.message : "Server error. Try again.",
            timestamp: new Date(),
          },
        ]);
      })
      .finally(() => {
        setIsTyping(false);
        e.target.value = "";
      });
  };

  const renderContent = (content: string) => {
    return content.split("\n").map((line, i) => {
      if (line.startsWith("## ")) {
        return <h3 key={i} className="text-sm font-semibold mt-2">{line.replace("## ", "")}</h3>;
      }
      return <p key={i} className="text-xs leading-relaxed">{line}</p>;
    });
  };

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
      >
        <Bot />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-[380px] h-[540px] flex flex-col shadow-xl">
      <div className="flex items-center justify-between px-4 py-3 bg-primary text-white">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <span className="text-sm font-semibold">Career Assistant</span>
        </div>
        <Button size="icon" variant="ghost" onClick={() => setOpen(false)}>
          <X />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 px-3 py-2 border-b">
        {QUICK_ACTIONS.map(a => (
          <button
            key={a.label}
            onClick={() => sendMessage(a.prompt)}
            disabled={isTyping}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-muted hover:bg-accent disabled:opacity-60"
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1 px-3 py-2" ref={scrollRef}>
        <div className="space-y-3">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] px-3 py-2 rounded-lg text-xs",
                  msg.role === "user"
                    ? "bg-primary text-white"
                    : "bg-muted"
                )}
              >
                {msg.role === "assistant"
                  ? renderContent(msg.content)
                  : msg.content}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Thinking...
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 px-3 py-2 border-t">
        <label className="cursor-pointer">
          <input
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx"
            onChange={handleResumeUpload}
            disabled={isTyping}
          />
          <div className="h-9 w-9 rounded-md flex items-center justify-center hover:bg-accent transition-colors text-muted-foreground">
            <Upload className="h-4 w-4" />
          </div>
        </label>
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage(input)}
          placeholder="Ask something..."
          className="text-xs"
          disabled={isTyping}
        />
        <Button size="icon" onClick={() => sendMessage(input)} disabled={isTyping}>
          {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send />}
        </Button>
      </div>
    </Card>
  );
}
