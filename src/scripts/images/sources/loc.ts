import type { TimelineEvent } from "../../../types/index.ts";
import type { CandidateImage, SourceAdapter } from "../types.ts";
import { normalizeUrl, buildQueries, readJsonOrThrow, sleep } from "../utils.ts";
import { RATE_LIMIT_MS } from "../config.ts";

const LOC_API = "https://www.loc.gov/photos";
const UA = "Mozilla/5.0 (compatible; history-explorer/1.0)";

async function fetchLocImages(query: string): Promise<CandidateImage[]> {
  const url = `${LOC_API}/?q=${encodeURIComponent(query)}&fo=json&c=30`;
  const resp = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  const data = await readJsonOrThrow(resp, "loc");
  const results = Array.isArray(data?.results) ? data.results : [];
  return results.map((item: any) => {
    const imageArray = Array.isArray(item?.image_url) ? item.image_url : [];
    const imageUrl = normalizeUrl(imageArray[0] || item?.image_url || "");
    if (!imageUrl) return null;
    return {
      url: imageUrl,
      title: String(item?.title || query || ""),
      creator: String(item?.creator || item?.contributor || ""),
      source: "Library of Congress", provider: "loc",
      license: String(item?.rights || item?.restrictions || "unknown"),
      landingUrl: normalizeUrl(item?.url || ""),
    };
  }).filter(Boolean) as CandidateImage[];
}

export const locAdapter: SourceAdapter = {
  name: "loc",
  async fetchCandidates(event: TimelineEvent): Promise<CandidateImage[]> {
    const queries = buildQueries(event);
    const all: CandidateImage[] = [];
    for (const query of queries) {
      try { all.push(...await fetchLocImages(query)); }
      catch (err: any) { console.warn(`    LOC query failed for "${query}": ${err?.message || String(err)}`); }
      await sleep(RATE_LIMIT_MS);
    }
    return all;
  },
};
