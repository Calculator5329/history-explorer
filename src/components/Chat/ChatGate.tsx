import { useAuth } from "../../hooks/useAuth.ts";
import ChatPanel from "./ChatPanel.tsx";
import ChatLoginScreen from "./ChatLoginScreen.tsx";
import type { ChatMessage as ChatMessageType, TimelineEvent, Source } from "../../types/index.ts";

interface ChatGateProps {
  messages: ChatMessageType[];
  sending: boolean;
  onSend: (message: string) => void;
  event?: TimelineEvent | null;
  streamingText?: string | null;
  streamingSources?: Source[];
}

export default function ChatGate({ messages, sending, onSend, event, streamingText, streamingSources }: ChatGateProps) {
  const { isAuthenticated, login } = useAuth();

  if (isAuthenticated) {
    return (
      <ChatPanel
        messages={messages}
        sending={sending}
        onSend={onSend}
        event={event}
        streamingText={streamingText}
        streamingSources={streamingSources}
      />
    );
  }

  return <ChatLoginScreen onLogin={login} />;
}
