import { useState } from "react";
import "./ChatLoginScreen.css";

interface ChatLoginScreenProps {
  onLogin: (password: string) => boolean;
  passwordConfigured: boolean;
}

export default function ChatLoginScreen({ onLogin, passwordConfigured }: ChatLoginScreenProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordConfigured) return;

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
      <p className="chat-login-desc">
        {passwordConfigured
          ? "Enter the password to unlock LLM topic questions."
          : "LLM chat is locked because no production password is configured."}
      </p>
      <form onSubmit={handleSubmit} className="chat-login-form">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="chat-login-input"
          autoComplete="current-password"
          autoFocus
          disabled={!passwordConfigured}
        />
        <button type="submit" disabled={!passwordConfigured || !password.trim()} className="chat-login-submit">
          Unlock
        </button>
      </form>
      {error && <p className="chat-login-error">{error}</p>}
    </div>
  );
}