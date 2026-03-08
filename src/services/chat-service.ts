import { proxy } from "../proxy.ts";
import type { TimelineEvent, ChatMessage, Source } from "../types/index.ts";
import { enrichEvent } from "./event-enricher.ts";

interface ChatResponse {
  message: ChatMessage;
  addedEvents: TimelineEvent[];
}

function buildSystemPrompt(existingEventTitles: string[]): string {
  const eventList = existingEventTitles.length > 0
    ? `\n\nEvents ALREADY on the timeline (do NOT add these again):\n${existingEventTitles.map(t => `- ${t}`).join("\n")}`
    : "";

  return `You are an expert historian. The user is exploring a historical event on an interactive timeline. Answer their questions with accurate, engaging information.

You will be provided with web search results. Use them to ground your answer with real citations.

IMPORTANT RULES:
1. Cite sources using [1], [2], etc. referencing the search results provided. Only cite sources that are relevant to your claims.
2. If your answer references historical events NOT currently on the timeline, you may add them. Output a JSON block at the VERY END of your response (after all text) in this EXACT format:

\`\`\`json
{"addedEvents": [{"title": "Event Name", "date": "YYYY-MM-DD", "branch": "branch_id", "importance": "major", "summary": "One sentence summary.", "eventType": "battle", "region": "western_europe", "wikipediaSearchQuery": "Search query for Wikipedia"}]}
\`\`\`

Valid branch IDs: european, pacific, homefront, diplomacy
Valid importance: critical, major, standard, minor
Valid eventType: battle, bombing, invasion, naval, treaty, declaration, surrender, homefront, political, liberation, evacuation
Valid region: western_europe, eastern_europe, pacific, north_africa, north_america, east_asia, southeast_asia, atlantic

3. NEVER add an event that is already on the timeline. Check the existing events list carefully.
4. Only add events that are directly relevant to the user's question and historically significant.
5. If uncertain about dates, use your best historical knowledge and note the uncertainty.
6. Always include eventType and region for added events when possible.
7. The JSON block must be valid JSON. Do NOT include trailing commas.${eventList}`;
}

function normalizeSourceUrl(url?: string): string {
  if (!url) return "";
  const trimmed = String(url).trim().replace(/[),.;]+$/g, "");
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate).href;
  } catch {
    return "";
  }
}

function getResultUrl(result: any): string {
  const candidates = [
    result?.url,
    result?.link,
    result?.href,
    result?.sourceUrl,
    result?.source?.url,
    result?.document?.url,
    result?.metadata?.url,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeSourceUrl(candidate);
    if (normalized) return normalized;
  }
  return "";
}

function prioritizeSources(sources: Source[]): Source[] {
  return [...sources].sort((a, b) => {
    const aWiki = /wikipedia\.org/i.test(a.url || "");
    const bWiki = /wikipedia\.org/i.test(b.url || "");
    if (aWiki === bWiki) return 0;
    return aWiki ? 1 : -1;
  });
}


async function searchForContext(query: string, eventTitle: string): Promise<Source[]> {
  try {
    const searchQuery = `${eventTitle} ${query} history`;
    const result: any = await (proxy as any).agent.search({
      query: searchQuery,
      num: 6,
    });
    if (result.results && Array.isArray(result.results)) {
      const sources = result.results
        .map((r: any) => ({
          title: r.title || r.name || "Untitled source",
          url: getResultUrl(r),
          snippet: r.snippet || r.description || "",
        }))
        .filter((s: Source) => Boolean(s.url));
      return prioritizeSources(sources);
    }
  } catch (err) {
    console.error("Web search failed:", err);
  }
  return [];
}

/**
 * Extract JSON event data from AI response text.
 * Handles: ```json {...} ```, bare JSON objects, and various whitespace.
 */
function extractJsonBlock(text: string): { parsed: any; cleanText: string } | null {
  // Try code-fenced JSON: ```json ... ```
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (fencedMatch) {
    try {
      const parsed = JSON.parse(fencedMatch[1].trim());
      if (parsed.addedEvents && Array.isArray(parsed.addedEvents)) {
        const cleanText = text.replace(/```json\s*[\s\S]*?```/, "").trim();
        return { parsed, cleanText };
      }
    } catch { /* try next approach */ }
  }

  // Try bare JSON at end of text: {"addedEvents": [...]}
  const bareMatch = text.match(/(\{"addedEvents"\s*:\s*\[[\s\S]*\]\s*\})\s*$/);
  if (bareMatch) {
    try {
      const parsed = JSON.parse(bareMatch[1]);
      if (parsed.addedEvents && Array.isArray(parsed.addedEvents)) {
        const cleanText = text.slice(0, bareMatch.index).trim();
        return { parsed, cleanText };
      }
    } catch { /* fall through */ }
  }

  return null;
}

/**
 * Streaming chat: yields partial text chunks, then returns the final result.
 */
export async function sendChatMessageStream(
  topicId: string,
  event: TimelineEvent,
  messages: ChatMessage[],
  userMessage: string,
  onChunk: (text: string, sources: Source[]) => void,
  existingEvents?: TimelineEvent[]
): Promise<ChatResponse> {
  // Search the web for relevant sources
  const searchSources = await searchForContext(userMessage, event.title);

  const sourceContext = searchSources.length > 0
    ? `\n\nWeb search results:\n${searchSources.map((s, i) => `[${i + 1}] ${s.title} (${s.url})\n${s.snippet}`).join("\n\n")}`
    : "";

  const eventContext = `Current event: "${event.title}" (${event.date})
Branch: ${event.branch}
Summary: ${event.summary}
${event.content ? `Detail: ${event.content}` : ""}${sourceContext}`;

  const existingTitles = (existingEvents || []).map(e => e.title);
  const systemPrompt = buildSystemPrompt(existingTitles);

  const stream = await (proxy.ai as any).chatStream({
    provider: "openai",
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: eventContext },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage },
    ],
    maxTokens: 1500,
  });

  let fullText = "";
  onChunk("", searchSources);

  const reader = stream.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      // Parse SSE lines: "data: {...}"
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            onChunk(fullText, searchSources);
          }
        } catch {
          // Incomplete JSON chunk — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Process the complete text (extract events, etc.)
  return processCompletedResponse(topicId, event, fullText, searchSources, existingTitles);
}

async function processCompletedResponse(
  topicId: string,
  event: TimelineEvent,
  fullText: string,
  searchSources: Source[],
  existingTitles: string[]
): Promise<ChatResponse> {
  let addedEvents: TimelineEvent[] = [];
  let displayText = fullText;

  const extracted = extractJsonBlock(fullText);
  if (extracted) {
    displayText = extracted.cleanText;

    const existingLower = new Set(existingTitles.map(t => t.toLowerCase()));
    const newEvents = extracted.parsed.addedEvents.filter(
      (ev: any) => !existingLower.has(ev.title?.toLowerCase())
    );

    const createdEvents: TimelineEvent[] = [];
    for (const ev of newEvents) {
      const newEvent = {
        title: ev.title,
        date: ev.date,
        branch: ev.branch || "european",
        importance: ev.importance || "standard",
        summary: ev.summary,
        eventType: ev.eventType,
        region: ev.region,
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
      enrichEvent(topicId, createdEvent).catch(console.error);
    }

    addedEvents = createdEvents;

    if (createdEvents.length > 0) {
      const newIds = createdEvents.map((e) => e.id);
      proxy.firestore.patch(`topics/${topicId}/events/${event.id}`, {
        connections: [...(event.connections || []), ...newIds],
      }).catch(console.error);

      try {
        const topicDoc: any = await proxy.firestore.get(`topics/${topicId}`);
        const existingIds: string[] = topicDoc?.eventIds || [];
        const mergedIds = [...new Set([...existingIds, ...newIds])];
        proxy.firestore.patch(`topics/${topicId}`, { eventIds: mergedIds }).catch(console.error);
      } catch {
        proxy.firestore.patch(`topics/${topicId}`, { eventIds: newIds }).catch(console.error);
      }
    }
  }

  if (searchSources.length > 0 && topicId && event.id) {
    autoImproveEvent(topicId, event, displayText, searchSources).catch(console.error);
  }

  const assistantMessage: ChatMessage = {
    role: "assistant",
    content: displayText,
    sources: searchSources.length > 0 ? searchSources : undefined,
    addedEvents: addedEvents.map((e) => e.id),
  };

  return { message: assistantMessage, addedEvents };
}

export async function sendChatMessage(
  topicId: string,
  event: TimelineEvent,
  messages: ChatMessage[],
  userMessage: string,
  existingEvents?: TimelineEvent[]
): Promise<ChatResponse> {
  // Search the web for relevant sources
  const searchSources = await searchForContext(userMessage, event.title);

  const sourceContext = searchSources.length > 0
    ? `\n\nWeb search results:\n${searchSources.map((s, i) => `[${i + 1}] ${s.title} (${s.url})\n${s.snippet}`).join("\n\n")}`
    : "";

  const eventContext = `Current event: "${event.title}" (${event.date})
Branch: ${event.branch}
Summary: ${event.summary}
${event.content ? `Detail: ${event.content}` : ""}${sourceContext}`;

  // Build system prompt with existing event titles to prevent duplicates
  const existingTitles = (existingEvents || []).map(e => e.title);
  const systemPrompt = buildSystemPrompt(existingTitles);

  const response = await (proxy.ai as any).chat({
    provider: "openai",
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
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

  const extracted = extractJsonBlock(fullText);
  if (extracted) {
    displayText = extracted.cleanText;

    // Filter out events that already exist (by similar title)
    const existingLower = new Set(existingTitles.map(t => t.toLowerCase()));
    const newEvents = extracted.parsed.addedEvents.filter(
      (ev: any) => !existingLower.has(ev.title?.toLowerCase())
    );

    // Write each new event to Firestore
    const createdEvents: TimelineEvent[] = [];
    for (const ev of newEvents) {
      const newEvent = {
        title: ev.title,
        date: ev.date,
        branch: ev.branch || "european",
        importance: ev.importance || "standard",
        summary: ev.summary,
        eventType: ev.eventType,
        region: ev.region,
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

    // Add bidirectional connections: update parent event to link back to new events
    // Also track new event IDs in topic doc for discoverability
    if (createdEvents.length > 0) {
      const newIds = createdEvents.map((e) => e.id);
      proxy.firestore.patch(`topics/${topicId}/events/${event.id}`, {
        connections: [...(event.connections || []), ...newIds],
      }).catch(console.error);

      // Add new event IDs to topic document so useTimeline can discover them
      try {
        const topicDoc: any = await proxy.firestore.get(`topics/${topicId}`);
        const existingIds: string[] = topicDoc?.eventIds || [];
        const mergedIds = [...new Set([...existingIds, ...newIds])];
        proxy.firestore.patch(`topics/${topicId}`, { eventIds: mergedIds }).catch(console.error);
      } catch {
        // If topic read fails, try blind patch with just the new IDs
        proxy.firestore.patch(`topics/${topicId}`, { eventIds: newIds }).catch(console.error);
      }
    }
  }

  // Auto-improve: merge new sources into the event and update its content
  if (searchSources.length > 0 && topicId && event.id) {
    autoImproveEvent(topicId, event, displayText, searchSources).catch(console.error);
  }

  const assistantMessage: ChatMessage = {
    role: "assistant",
    content: displayText,
    sources: searchSources.length > 0 ? searchSources : undefined,
    addedEvents: addedEvents.map((e) => e.id),
  };

  return { message: assistantMessage, addedEvents };
}

/**
 * Asynchronously improve the current event's content and sources
 * based on new information from the chat interaction.
 */
async function autoImproveEvent(
  topicId: string,
  event: TimelineEvent,
  chatResponse: string,
  newSources: Source[]
): Promise<void> {
  // Merge new unique sources into existing sources and prioritize non-Wikipedia references.
  const normalizedExisting = (event.sources || []).map((s) => ({ ...s, url: normalizeSourceUrl(s.url) })).filter((s) => s.url);
  const normalizedNew = newSources.map((s) => ({ ...s, url: normalizeSourceUrl(s.url) })).filter((s) => s.url);
  const existingUrls = new Set(normalizedExisting.map((s) => s.url));
  const uniqueNewSources = normalizedNew.filter((s) => !existingUrls.has(s.url));

  if (uniqueNewSources.length === 0) return;

  const mergedSources = prioritizeSources([...uniqueNewSources, ...normalizedExisting]);

  // Generate improved content using the chat response as additional context
  const allSourceContext = mergedSources
    .map((s, i) => `[${i + 1}] ${s.title}: ${s.snippet}`)
    .join("\n");

  try {
    const response: any = await (proxy as any).ai.chat({
      provider: "openai",
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a historian writing an engaging, detailed explanation of a historical event. Use inline citations [1], [2], etc. referencing the provided sources. Write 2-4 paragraphs. Be factual and vivid.`,
        },
        {
          role: "user",
          content: `Write about: ${event.title} (${event.date})

Summary: ${event.summary}

${event.wikipediaExtract ? `Wikipedia context: ${event.wikipediaExtract}` : ""}

Additional context from recent research:
${chatResponse.slice(0, 800)}

Available sources:
${allSourceContext}`,
        },
      ],
      maxTokens: 1024,
    });

    const improvedContent = response.content;

    // Update Firestore with improved content and merged sources
    await proxy.firestore.patch(`topics/${topicId}/events/${event.id}`, {
      content: improvedContent,
      sources: mergedSources,
    });
  } catch (err) {
    console.error("Auto-improve failed:", err);
  }
}





