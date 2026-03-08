import { proxy } from "../proxy.ts";
import type { TimelineEvent, Source } from "../types/index.ts";

// ── Helpers ─────────────────────────────────────────────────────────────────

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
  for (const key of ["url", "link", "href", "sourceUrl"]) {
    const normalized = normalizeSourceUrl(result?.[key]);
    if (normalized) return normalized;
  }
  for (const path of ["source.url", "document.url", "metadata.url"]) {
    const [a, b] = path.split(".");
    const normalized = normalizeSourceUrl(result?.[a]?.[b]);
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

function deduplicateSources(sources: Source[]): Source[] {
  const seen = new Set<string>();
  return sources
    .map((s) => ({ ...s, url: normalizeSourceUrl(s.url) }))
    .filter((s) => Boolean(s.url))
    .filter((s) => {
      if (seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });
}

// ── Wikipedia extract (text only, no images) ────────────────────────────────

async function fetchWikipediaExtract(query: string): Promise<string | undefined> {
  try {
    const encoded = encodeURIComponent(query.replace(/ /g, "_"));
    const resp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`
    );
    if (resp.ok) {
      const data = await resp.json();
      return data.extract || undefined;
    }
  } catch {
    // Non-critical
  }
  return undefined;
}

// ── Deduplication ───────────────────────────────────────────────────────────
// Prevent concurrent enrichment of the same event (React strict mode, re-renders)
const pendingEnrichments = new Map<string, Promise<TimelineEvent>>();
const pendingContent = new Map<string, Promise<string>>();

// ── Public API ──────────────────────────────────────────────────────────────

export async function enrichEvent(
  topicId: string,
  event: TimelineEvent
): Promise<TimelineEvent> {
  const hasDiverseSources = event.sources?.some(
    (s) => s.url && !/wikipedia\.org/i.test(s.url)
  );
  if (event.enriched && event.content && hasDiverseSources) return event;

  const key = `${topicId}/${event.id}`;
  if (pendingEnrichments.has(key)) return pendingEnrichments.get(key)!;

  const promise = _doEnrichEvent(topicId, event).finally(() => {
    pendingEnrichments.delete(key);
  });
  pendingEnrichments.set(key, promise);
  return promise;
}

async function _doEnrichEvent(
  topicId: string,
  event: TimelineEvent
): Promise<TimelineEvent> {
  let extract = event.wikipediaExtract;
  let sources = event.sources || [];

  // Step 1: Fetch Wikipedia extract (text context for content generation)
  if (!extract) {
    extract = await fetchWikipediaExtract(event.wikipediaSearchQuery || event.title);
  }

  // Step 2: Web search (Brave) for diverse citation sources
  try {
    const searchQuery = `${event.title} ${event.date} history`;
    const result: any = await (proxy as any).agent.search({
      query: searchQuery,
      num: 6,
    });
    if (result.results && Array.isArray(result.results)) {
      const webSources: Source[] = result.results
        .map((r: any) => ({
          title: r.title || r.name || "Untitled source",
          url: getResultUrl(r),
          snippet: r.snippet || r.description || "",
        }))
        .filter((s: Source) => Boolean(s.url));
      if (webSources.length > 0) {
        sources = prioritizeSources([...webSources, ...sources]);
      }
    }
  } catch (err) {
    console.warn(`Web search failed for "${event.title}":`, err);
  }

  const updated: Partial<TimelineEvent> = {
    enriched: true,
    wikipediaExtract: extract,
    sources: prioritizeSources(deduplicateSources(sources)),
  };

  proxy.firestore
    .patch(`topics/${topicId}/events/${event.id}`, updated)
    .catch((err) => {
      console.warn("Firestore save after enrichment failed:", err);
    });

  return { ...event, ...updated };
}

export async function generateEventContent(
  topicId: string,
  event: TimelineEvent,
  forceRegenerate?: boolean
): Promise<string> {
  if (event.content && !forceRegenerate) return event.content;

  const key = `${topicId}/${event.id}`;
  if (pendingContent.has(key)) return pendingContent.get(key)!;

  const promise = _doGenerateContent(topicId, event).finally(() => {
    pendingContent.delete(key);
  });
  pendingContent.set(key, promise);
  return promise;
}

async function _doGenerateContent(
  topicId: string,
  event: TimelineEvent
): Promise<string> {
  const sources = prioritizeSources(deduplicateSources(event.sources || []));
  const sourceContext = sources
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

Summary: ${event.summary || ""}

${event.wikipediaExtract ? `Wikipedia context: ${event.wikipediaExtract}` : ""}

Available sources:
${sourceContext || "No sources available yet. Write based on well-known historical facts and note that sources are being gathered."}`,
      },
    ],
    maxTokens: 1024,
  });

  const content = response.content;

  proxy.firestore
    .patch(`topics/${topicId}/events/${event.id}`, { content })
    .catch((err) => {
      console.warn("Firestore content save failed:", err);
    });

  return content;
}
