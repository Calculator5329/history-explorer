import { useState } from "react";
import "./ChatLoginScreen.css";

interface ChatLoginScreenProps {
  onLogin: (password: string) => boolean;
}

export default function ChatLoginScreen({ onLogin }: ChatLoginScreenProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const ok = onLogin(password);
    if (!ok) {
      setError("Incorrect password");
      setPassword("");
    }
  };

  return (
    <div className="chat-login">
      <h3 className="chat-login-title">Unlock AI Chat</h3>
      <p className="chat-login-desc">Enter the password to use the LLM chat feature.</p>
      <form onSubmit={handleSubmit} className="chat-login-form">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="chat-login-input"
          autoComplete="current-password"
          autoFocus
        />
        <button type="submit" disabled={!password.trim()} className="chat-login-submit">
          Unlock
        </button>
      </form>
      {error && <p className="chat-login-error">{error}</p>}
    </div>
  );
}
