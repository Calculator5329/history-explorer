import { useState, useCallback } from "react";
import { sendChatMessage } from "../services/chat-service.ts";
import type { TimelineEvent, ChatMessage } from "../types/index.ts";

export function useChat(topicId: string | undefined, event: TimelineEvent | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [addedEventIds, setAddedEventIds] = useState<string[]>([]);

  const send = useCallback(
    async (userMessage: string) => {
      if (!topicId || !event || sending) return;

      const userMsg: ChatMessage = { role: "user", content: userMessage };
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);

      try {
        const { message, addedEvents } = await sendChatMessage(
          topicId,
          event,
          messages,
          userMessage
        );
        setMessages((prev) => [...prev, message]);
        if (addedEvents.length > 0) {
          setAddedEventIds((prev) => [...prev, ...addedEvents.map((e) => e.id)]);
        }
      } catch (err) {
        const errorMsg: ChatMessage = {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        };
        setMessages((prev) => [...prev, errorMsg]);
        console.error("Chat error:", err);
      } finally {
        setSending(false);
      }
    },
    [topicId, event, messages, sending]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setAddedEventIds([]);
  }, []);

  return { messages, sending, send, reset, addedEventIds };
}
