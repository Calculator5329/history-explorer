import { useMemo } from "react";
import { marked } from "marked";
import type { ChatMessage as ChatMessageType } from "../../types/index.ts";
import AddedEventIndicator from "./AddedEventIndicator.tsx";

marked.setOptions({
  breaks: true,
  gfm: true,
});

interface ChatMessageProps {
  message: ChatMessageType;
}

function toHref(url?: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim().replace(/[),.;]+$/g, "");
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate).href;
  } catch {
    return undefined;
  }
}

function linkifyCitationMarkers(content: string, message: ChatMessageType): string {
  if (!message.sources || message.sources.length === 0) return content;
  return content.replace(/\[(\d+)\]/g, (match, indexStr) => {
    const index = Number(indexStr) - 1;
    const source = message.sources?.[index];
    const href = toHref(source?.url);
    if (!href) return match;
    return `[${indexStr}](<${href}>)`;
  });
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const html = useMemo(() => {
    if (message.role === "user") return null;
    const contentWithCitationLinks = linkifyCitationMarkers(message.content, message);
    return marked.parse(contentWithCitationLinks) as string;
  }, [message]);

  return (
    <div className={`chat-message chat-message-${message.role}`}>
      {message.role === "user" ? (
        <div className="chat-message-content">{message.content}</div>
      ) : (
        <div
          className="chat-message-content chat-markdown"
          dangerouslySetInnerHTML={{ __html: html! }}
        />
      )}
      {message.sources && message.sources.length > 0 && (
        <div className="chat-sources">
          <span className="chat-sources-label">Sources:</span>
          <ol className="chat-sources-list">
            {message.sources.map((source, i) => {
              const href = toHref(source.url);
              return (
                <li key={i}>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {source.title || href}
                    </a>
                  ) : (
                    <span>{source.title || "Unresolved source URL"}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
      {message.addedEvents && message.addedEvents.length > 0 && (
        <AddedEventIndicator eventIds={message.addedEvents} />
      )}
    </div>
  );
}
