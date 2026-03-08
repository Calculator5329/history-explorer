import { proxy } from "../proxy.ts";
import type { TimelineEvent } from "../types/index.ts";

export async function enrichEvent(
  topicId: string,
  event: TimelineEvent
): Promise<TimelineEvent> {
  if (event.enriched) return event;

  try {
    // Use the proxy agent's enrichEvent which handles Wikipedia + search
    const result: any = await (proxy as any).agent.enrichEvent({
      timelineId: topicId,
      eventId: event.id,
      event: {
        title: event.title,
        date: event.date,
        wikipedia_search_query: event.wikipediaSearchQuery || event.title,
      },
    });

    const updated: Partial<TimelineEvent> = {
      enriched: true,
      wikipediaImageUrl: result.wikipediaImageUrl || event.wikipediaImageUrl,
      wikipediaExtract: result.wikipediaExtract || event.wikipediaExtract,
      sources: result.sources || event.sources,
    };

    // Update Firestore
    await proxy.firestore.patch(`topics/${topicId}/events/${event.id}`, updated);

    return { ...event, ...updated };
  } catch (err) {
    console.error("Enrichment failed:", err);
    return event;
  }
}

export async function generateEventContent(
  topicId: string,
  event: TimelineEvent
): Promise<string> {
  if (event.content) return event.content;

  // Build source context for the LLM
  const sourceContext = event.sources
    .map((s, i) => `[${i + 1}] ${s.title}: ${s.snippet}`)
    .join("\n");

  const response: any = await (proxy as any).ai.chat({
    provider: "openai",
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a historian writing an engaging, detailed explanation of a historical event. Use inline citations [1], [2], etc. referencing the provided sources. Be factual. Do not invent claims without source backing. Write 2-4 paragraphs.`,
      },
      {
        role: "user",
        content: `Write about: ${event.title} (${event.date})

Summary: ${event.summary}

${event.wikipediaExtract ? `Wikipedia context: ${event.wikipediaExtract}` : ""}

Available sources:
${sourceContext || "No sources available yet. Write based on well-known historical facts and note that sources are being gathered."}`,
      },
    ],
    maxTokens: 1024,
  });

  const content = response.content;

  // Save to Firestore
  await proxy.firestore.patch(`topics/${topicId}/events/${event.id}`, { content });

  return content;
}
