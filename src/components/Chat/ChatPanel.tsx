import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import ChatMessage from "./ChatMessage.tsx";
import type { ChatMessage as ChatMessageType, TimelineEvent, Source } from "../../types/index.ts";
import "./ChatPanel.css";

interface ChatPanelProps {
  messages: ChatMessageType[];
  sending: boolean;
  onSend: (message: string) => void;
  event?: TimelineEvent | null;
  streamingText?: string | null;
  streamingSources?: Source[];
}

function getSuggestedQuestions(event?: TimelineEvent | null): string[] {
  if (!event) {
    return [
      "What were the key turning points of this period?",
      "Who were the major figures involved?",
      "What was happening on the home front?",
    ];
  }

  const base = [
    `What led to ${event.title}?`,
    `What were the consequences of ${event.title}?`,
    `Who were the key figures involved?`,
  ];

  if (event.branch === "european") {
    base.push("What was happening in the Pacific at this time?");
  } else if (event.branch === "pacific") {
    base.push("What was happening in Europe at this time?");
  } else if (event.branch === "homefront") {
    base.push("How did this affect the war effort?");
  } else if (event.branch === "diplomacy") {
    base.push("What military events influenced this decision?");
  }

  return base;
}

export default function ChatPanel({
  messages,
  sending,
  onSend,
  event,
  streamingText,
  streamingSources,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  const suggestedQuestions = useMemo(() => getSuggestedQuestions(event), [event?.id]);

  // Auto-scroll only when a real message is added, not on every streaming chunk.
  useEffect(() => {
    if (!userScrolledRef.current || messages.length === 0) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const scrollOnSend = useCallback(() => {
    userScrolledRef.current = true;
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    scrollOnSend();
    onSend(trimmed);
    setInput("");
  };

  const handleSuggestionClick = (question: string) => {
    if (sending) return;
    scrollOnSend();
    onSend(question);
  };

  return (
    <div className="chat-panel">
      <h3 className="chat-title">Ask about this event</h3>

      {messages.length === 0 && (
        <div className="chat-suggestions">
          {suggestedQuestions.map((q, i) => (
            <button
              key={i}
              className="chat-suggestion"
              onClick={() => handleSuggestionClick(q)}
              disabled={sending}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div className="chat-messages" ref={messagesContainerRef}>
          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}
          {sending &&
            (streamingText ? (
              <ChatMessage
                message={{
                  role: "assistant",
                  content: streamingText,
                  sources: streamingSources,
                }}
              />
            ) : (
              <div className="chat-message chat-message-assistant">
                <div className="chat-typing">Searching & thinking...</div>
              </div>
            ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about this event..."
          disabled={sending}
          className="chat-input"
        />
        <button type="submit" disabled={sending || !input.trim()} className="chat-send">
          Send
        </button>
      </form>
    </div>
  );
}
