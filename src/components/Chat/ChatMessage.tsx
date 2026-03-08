import type { ChatMessage as ChatMessageType } from "../../types/index.ts";
import AddedEventIndicator from "./AddedEventIndicator.tsx";

interface ChatMessageProps {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className={`chat-message chat-message-${message.role}`}>
      <div className="chat-message-content">{message.content}</div>
      {message.addedEvents && message.addedEvents.length > 0 && (
        <AddedEventIndicator eventIds={message.addedEvents} />
      )}
    </div>
  );
}
