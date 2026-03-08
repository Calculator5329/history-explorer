import { useState, useRef, useEffect } from "react";
import ChatMessage from "./ChatMessage.tsx";
import type { ChatMessage as ChatMessageType } from "../../types/index.ts";
import "./ChatPanel.css";

interface ChatPanelProps {
  messages: ChatMessageType[];
  sending: boolean;
  onSend: (message: string) => void;
}

export default function ChatPanel({ messages, sending, onSend }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    onSend(trimmed);
    setInput("");
  };

  return (
    <div className="chat-panel">
      <h3 className="chat-title">Ask about this event</h3>

      {messages.length > 0 && (
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}
          {sending && (
            <div className="chat-message chat-message-assistant">
              <div className="chat-typing">Thinking...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What was happening in the Pacific at this time?"
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
