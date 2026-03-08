import { useAuth } from "../../hooks/useAuth.ts";
import ChatPanel from "./ChatPanel.tsx";
import ChatLoginScreen from "./ChatLoginScreen.tsx";
import type { ChatMessage as ChatMessageType } from "../../types/index.ts";

interface ChatGateProps {
  messages: ChatMessageType[];
  sending: boolean;
  onSend: (message: string) => void;
}

export default function ChatGate({ messages, sending, onSend }: ChatGateProps) {
  const { isAuthenticated, login } = useAuth();

  if (isAuthenticated) {
    return <ChatPanel messages={messages} sending={sending} onSend={onSend} />;
  }

  return <ChatLoginScreen onLogin={login} />;
}
