import { proxy } from "../proxy.ts";
import type { TimelineEvent, ChatMessage, Source } from "../types/index.ts";
import { enrichEvent } from "./event-enricher.ts";

interface ChatResponse {
  message: ChatMessage;
  addedEvents: TimelineEvent[];
}

const CHAT_SYSTEM_PROMPT = `You are an expert historian. The user is exploring a historical event on an interactive timeline. Answer their questions with accurate, engaging information.

IMPORTANT RULES:
1. Always cite sources when making specific claims.
2. If your answer references historical events NOT currently on the timeline, output them as a JSON block at the end of your response in this exact format:

\`\`\`json
{"addedEvents": [{"title": "Event Name", "date": "YYYY-MM-DD", "branch": "branch_id", "importance": "major", "summary": "One sentence summary.", "wikipediaSearchQuery": "Search query for Wikipedia"}]}
\`\`\`

Valid branch IDs: european, pacific, homefront, diplomacy
Valid importance: critical, major, standard, minor

3. Only add events that are directly relevant to the user's question and historically significant.
4. If uncertain about dates, use your best historical knowledge and note the uncertainty.`;

export async function sendChatMessage(
  topicId: string,
  event: TimelineEvent,
  messages: ChatMessage[],
  userMessage: string
): Promise<ChatResponse> {
  const eventContext = `Current event: "${event.title}" (${event.date})
Branch: ${event.branch}
Summary: ${event.summary}
${event.content ? `Detail: ${event.content}` : ""}`;

  const response = await (proxy.ai as any).chat({
    provider: "openai",
    model: "gpt-4o",
    messages: [
      { role: "system", content: CHAT_SYSTEM_PROMPT },
      { role: "user", content: eventContext },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage },
    ],
    maxTokens: 1500,
  });

  const fullText = response.content;

  // Parse added events from JSON block
  let addedEvents: TimelineEvent[] = [];
  let displayText = fullText;

  const jsonMatch = fullText.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.addedEvents && Array.isArray(parsed.addedEvents)) {
        // Remove JSON block from display text
        displayText = fullText.replace(/```json[\s\S]*?```/, "").trim();

        // Write each new event to Firestore
        const createdEvents: TimelineEvent[] = [];
        for (const ev of parsed.addedEvents) {
          const newEvent = {
            title: ev.title,
            date: ev.date,
            branch: ev.branch || "european",
            importance: ev.importance || "standard",
            summary: ev.summary,
            sources: [],
            connections: [event.id],
            generatedBy: "chat",
            enriched: false,
            wikipediaSearchQuery: ev.wikipediaSearchQuery || ev.title,
          };

          const created = await (proxy.firestore as any).create(
            `topics/${topicId}/events`,
            newEvent
          );

          const createdEvent = { ...newEvent, id: created.id } as TimelineEvent;
          createdEvents.push(createdEvent);

          // Trigger async enrichment (don't await)
          enrichEvent(topicId, createdEvent).catch(console.error);
        }

        addedEvents = createdEvents;
      }
    } catch {
      // JSON parse failed, just show full text
      displayText = fullText;
    }
  }

  const assistantMessage: ChatMessage = {
    role: "assistant",
    content: displayText,
    addedEvents: addedEvents.map((e) => e.id),
  };

  return { message: assistantMessage, addedEvents };
}
