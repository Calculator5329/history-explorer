import type { TimelineEvent } from "../../../types/index.ts";
import type { CandidateImage, SourceAdapter } from "../types.ts";
import { normalizeUrl, buildQueries, pickStringValues, readJsonOrThrow, sleep } from "../utils.ts";
import { naraApiKey, RATE_LIMIT_MS } from "../config.ts";

const NARA_API_V1 = "https://catalog.archives.gov/api/v1";
const NARA_API_V2 = "https://catalog.archives.gov/api/v2/records/search";
const UA = "Mozilla/5.0 (compatible; history-explorer/1.0)";

async function fetchNaraV2(query: string): Promise<CandidateImage[]> {
  const params = new URLSearchParams({ q: query, rows: "30", availableOnline: "true" });
  const resp = await fetch(`${NARA_API_V2}?${params}`, {
    headers: { "User-Agent": UA, Accept: "application/json", "x-api-key": naraApiKey },
  });
  const data = await readJsonOrThrow(resp, "nara");
  const hits = Array.isArray(data?.body?.hits?.hits) ? data.body.hits.hits : [];
  const mapped: CandidateImage[] = [];
  for (const hit of hits) {
    const src = hit?._source ?? hit;
    const title = pickStringValues(src, ["title", "naIdTitle", "description"]).at(0) || query;
    const creators = pickStringValues(src, ["creator", "contributor", "name"]);
    const urls = pickStringValues(src, ["@url", "url", "thumbnail", "thumbnailUrl", "file", "objectUrl"]);
    const imageUrl = urls.find((u) => /\.(jpg|jpeg|png|webp)($|\?)/i.test(u)) || urls[0] || "";
    if (!imageUrl) continue;
    mapped.push({
      url: normalizeUrl(imageUrl), title,
      creator: creators[0] || "National Archives",
      source: "US National Archives", provider: "nara",
      license: "public domain/varies",
      landingUrl: urls.find((u) => /archives\.gov/i.test(u)) || "",
    });
  }
  return mapped;
}

async function fetchNaraV1(query: string): Promise<CandidateImage[]> {
  const url = `${NARA_API_V1}?q=${encodeURIComponent(query)}&resultTypes=item&rows=30&availableOnline=true`;
  const resp = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  const data = await readJsonOrThrow(resp, "nara");
  const results = Array.isArray(data?.opaResponse?.results?.result) ? data.opaResponse.results.result
    : Array.isArray(data?.result) ? data.result : [];
  const mapped: CandidateImage[] = [];
  for (const item of results) {
    const title = pickStringValues(item, ["title", "naIdTitle", "description"]).at(0) || query;
    const creators = pickStringValues(item, ["creator", "contributor", "name"]);
    const urls = pickStringValues(item, ["@url", "url", "thumbnail", "thumbnailUrl", "file"]);
    const imageUrl = urls.find((u) => /\.(jpg|jpeg|png|webp)($|\?)/i.test(u)) || urls[0] || "";
    if (!imageUrl) continue;
    mapped.push({
      url: normalizeUrl(imageUrl), title,
      creator: creators[0] || "National Archives",
      source: "US National Archives", provider: "nara",
      license: "public domain/varies",
      landingUrl: urls.find((u) => /archives\.gov/i.test(u)) || "",
    });
  }
  return mapped;
}

export const naraApiAdapter: SourceAdapter = {
  name: "nara",
  async fetchCandidates(event: TimelineEvent): Promise<CandidateImage[]> {
    const queries = buildQueries(event);
    const all: CandidateImage[] = [];
    for (const query of queries) {
      try {
        const results = naraApiKey ? await fetchNaraV2(query) : await fetchNaraV1(query);
        all.push(...results);
      } catch (err: any) {
        console.warn(`    NARA query failed for "${query}": ${err?.message || String(err)}`);
      }
      await sleep(RATE_LIMIT_MS);
    }
    return all;
  },
};
