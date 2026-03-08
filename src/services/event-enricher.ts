import { proxy } from "../proxy.ts";
import type { TimelineEvent, Source } from "../types/index.ts";

interface WikiResult {
  imageUrl?: string;
  extract?: string;
  sources: Source[];
}

/**
 * Fetch Wikipedia image, extract, AND build source references.
 * Works from the browser without any proxy/agent dependency.
 */
async function fetchWikipediaData(query: string): Promise<WikiResult> {
  const sources: Source[] = [];

  try {
    // Try direct page summary first
    const encoded = encodeURIComponent(query.replace(/ /g, "_"));
    const resp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`
    );
    if (resp.ok) {
      const data = await resp.json();
      const imageUrl = upscaleWikipediaThumb(
        data.originalimage?.source || data.thumbnail?.source
      );

      // Build primary Wikipedia source
      if (data.content_urls?.desktop?.page) {
        sources.push({
          title: data.title || query,
          url: data.content_urls.desktop.page,
          snippet: data.description || data.extract?.slice(0, 150) || "",
        });
      }

      // Search for related Wikipedia articles to build additional sources
      const related = await fetchRelatedSources(query);
      sources.push(...related);

      if (imageUrl) {
        return { imageUrl, extract: data.extract, sources };
      }
    }

    // Fallback: search Wikipedia then fetch the top result's summary
    const searchResp = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`
    );
    if (searchResp.ok) {
      const searchData = await searchResp.json();
      const firstResult = searchData.query?.search?.[0];
      if (firstResult) {
        const pageResp = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstResult.title.replace(/ /g, "_"))}`
        );
        if (pageResp.ok) {
          const pageData = await pageResp.json();

          if (pageData.content_urls?.desktop?.page) {
            sources.push({
              title: pageData.title || query,
              url: pageData.content_urls.desktop.page,
              snippet: pageData.description || pageData.extract?.slice(0, 150) || "",
            });
          }

          const related = await fetchRelatedSources(query);
          sources.push(...related);

          return {
            imageUrl: upscaleWikipediaThumb(
              pageData.originalimage?.source || pageData.thumbnail?.source
            ),
            extract: pageData.extract,
            sources,
          };
        }
      }
    }
  } catch (err) {
    console.warn("Wikipedia direct fetch failed:", err);
  }
  return { sources };
}

/**
 * Search Wikipedia for related articles to build a list of source references.
 * Returns up to 5 sources (the primary article + 4 related).
 */
async function fetchRelatedSources(query: string): Promise<Source[]> {
  const sources: Source[] = [];
  // Filter out non-historical results (films, albums, games, TV, etc.)
  const NOISE_PATTERNS = /\((film|album|song|TV|video game|band|novel|musical|series|book)\)/i;

  try {
    const resp = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search` +
        `&srsearch=${encodeURIComponent(query)}` +
        `&srlimit=8&format=json&origin=*`
    );
    if (!resp.ok) return sources;
    const data = await resp.json();
    const results = data.query?.search || [];

    for (const result of results) {
      if (NOISE_PATTERNS.test(result.title)) continue;
      // Strip HTML from snippet
      const snippet = result.snippet
        ?.replace(/<[^>]*>/g, "")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&") || "";
      sources.push({
        title: result.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, "_"))}`,
        snippet,
      });
      if (sources.length >= 5) break;
    }
  } catch {
    // Non-critical — silently skip
  }
  return sources;
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

/** Deduplicate sources by URL */
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

/** Upscale Wikipedia thumbnail to 800px width for better display */
function upscaleWikipediaThumb(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/\d+px-/, "/800px-");
}

// ── Deduplication ───────────────────────────────────────────────────────────
// Prevent concurrent enrichment of the same event (React strict mode, re-renders)
const pendingEnrichments = new Map<string, Promise<TimelineEvent>>();
const pendingContent = new Map<string, Promise<string>>();

export async function enrichEvent(
  topicId: string,
  event: TimelineEvent
): Promise<TimelineEvent> {
  const hasDiverseSources = event.sources?.some(
    (s) => s.url && !/wikipedia\.org/i.test(s.url)
  );
  // Skip only if fully enriched with diverse (non-Wikipedia) sources
  if (event.enriched && event.wikipediaImageUrl && hasDiverseSources) return event;

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

  let imageUrl = event.wikipediaImageUrl;
  let extract = event.wikipediaExtract;
  let sources = event.sources || [];

  // Skip Wikipedia strategies if already enriched with image — only need Brave sources
  const needsWikipedia = !imageUrl || sources.length === 0;

  if (needsWikipedia) {
    // Strategy 1: Try the proxy agent enrichment
    try {
      const result: any = await (proxy as any).agent.enrichEvent({
        timelineId: topicId,
        eventId: event.id,
        event: {
          title: event.title,
          date: event.date,
          wikipedia_search_query: event.wikipediaSearchQuery || event.title,
        },
      });

      imageUrl = result.wikipediaImageUrl || imageUrl;
      extract = result.wikipediaExtract || extract;
      sources = result.sources || sources;
      console.log(`Agent enrichment succeeded for "${event.title}"`);
    } catch (err) {
      console.warn(`Agent enrichment failed for "${event.title}":`, err);
    }

    // Strategy 2: Direct Wikipedia API (always try if no image or no sources)
    if (!imageUrl || sources.length === 0) {
      console.log(`Trying Wikipedia API directly for "${event.title}"...`);
      const wikiData = await fetchWikipediaData(
        event.wikipediaSearchQuery || event.title
      );
      imageUrl = wikiData.imageUrl || imageUrl;
      extract = wikiData.extract || extract;
      if (sources.length === 0 && wikiData.sources.length > 0) {
        sources = wikiData.sources;
      }
      if (imageUrl) {
        console.log(`Wikipedia API found image for "${event.title}"`);
      }
    }
  }

  // Strategy 3: Web search (Brave) for diverse sources (Britannica, academic, etc.)
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
        console.log(`Web search added ${webSources.length} sources for "${event.title}"`);
      }
    }
  } catch (err) {
    console.warn(`Web search failed for "${event.title}":`, err);
  }

  const updated: Partial<TimelineEvent> = {
    enriched: true,
    wikipediaImageUrl: imageUrl,
    wikipediaExtract: extract,
    sources: prioritizeSources(deduplicateSources(sources)),
  };

  // Save to Firestore (non-blocking - don't fail enrichment on save error)
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

  // Save to Firestore (non-blocking)
  proxy.firestore
    .patch(`topics/${topicId}/events/${event.id}`, { content })
    .catch((err) => {
      console.warn("Firestore content save failed:", err);
    });

  return content;
}



