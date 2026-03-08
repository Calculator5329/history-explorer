# Changelog

## 2026-03-08

- Fixed Anthropic chat payloads in `src/services/chat-service.ts` to send `system` as a top-level field instead of a `messages` entry. This aligns `history-explorer` with Anthropic's `/v1/messages` format and the working `gates-ai-agent` usage.
- Added a fallback in `src/hooks/useChat.ts` so the event chat retries with the non-streaming Anthropic request when the streaming path returns `401`. This keeps chat usable even when the browser-triggered streaming branch fails upstream.
- Switched chat from Anthropic to OpenAI (`gpt-4o`) in `src/services/chat-service.ts` because the gateway's Anthropic upstream returns 401 for browser requests while OpenAI works. Event enrichment and timeline builder already use OpenAI successfully.
