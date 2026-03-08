import { useState, useCallback } from "react";
import { sendChatMessage, sendChatMessageStream } from "../services/chat-service.ts";
import type { TimelineEvent, ChatMessage, Source } from "../types/index.ts";

export function useChat(
  topicId: string | undefined,
  event: TimelineEvent | null,
  allEvents?: TimelineEvent[]
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [addedEventIds, setAddedEventIds] = useState<string[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [streamingSources, setStreamingSources] = useState<Source[]>([]);

  const send = useCallback(
    async (userMessage: string) => {
      if (!topicId || !event || sending) return;

      const userMsg: ChatMessage = { role: "user", content: userMessage };
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);
      setStreamingText("");
      setStreamingSources([]);

      try {
        let result;
        try {
          result = await sendChatMessageStream(
            topicId,
            event,
            messages,
            userMessage,
            (partial, sources) => {
              setStreamingText(partial);
              setStreamingSources(sources);
            },
            allEvents
          );
        } catch (err: any) {
          const status = err?.status ?? err?.response?.status;
          if (status !== 401) throw err;

          // Some Anthropic requests succeed non-streaming while the streaming path returns 401.
          result = await sendChatMessage(
            topicId,
            event,
            messages,
            userMessage,
            allEvents
          );
        }

        const { message, addedEvents } = result;
        setStreamingText(null);
        setStreamingSources([]);
        setMessages((prev) => [...prev, message]);
        if (addedEvents.length > 0) {
          setAddedEventIds((prev) => [...prev, ...addedEvents.map((e) => e.id)]);
        }
      } catch (err: any) {
        setStreamingText(null);
        setStreamingSources([]);
        const status = err?.status ?? err?.response?.status;
        const content =
          status === 429
            ? "The AI service is currently busy. Please wait a moment and try again."
            : "Sorry, I encountered an error. Please try again.";
        const errorMsg: ChatMessage = { role: "assistant", content };
        setMessages((prev) => [...prev, errorMsg]);
        console.error("Chat error:", err);
      } finally {
        setSending(false);
      }
    },
    [topicId, event, messages, sending, allEvents]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setAddedEventIds([]);
    setStreamingText(null);
    setStreamingSources([]);
  }, []);

  return { messages, sending, send, reset, addedEventIds, streamingText, streamingSources };
}
