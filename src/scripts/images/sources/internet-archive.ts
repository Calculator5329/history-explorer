import type { TimelineEvent } from "../../../types/index.ts";
import type { CandidateImage, SourceAdapter } from "../types.ts";
import { normalizeUrl, buildQueries, readJsonOrThrow, sleep } from "../utils.ts";
import { RATE_LIMIT_MS } from "../config.ts";

const IA_SEARCH_API = "https://archive.org/advancedsearch.php";
const UA = "Mozilla/5.0 (compatible; history-explorer/1.0)";

async function fetchIaImages(query: string): Promise<CandidateImage[]> {
  const q = `(title:(${query}) OR subject:(${query})) AND mediatype:(image)`;
  const params = new URLSearchParams({ q, "fl[]": "identifier,title,creator,licenseurl", rows: "30", page: "1", output: "json" });
  const resp = await fetch(`${IA_SEARCH_API}?${params}`, { headers: { "User-Agent": UA, Accept: "application/json" } });
  const data = await readJsonOrThrow(resp, "ia");
  const docs = Array.isArray(data?.response?.docs) ? data.response.docs : [];
  return docs
    .map((doc: any) => {
      const identifier = String(doc?.identifier || "").trim();
      if (!identifier) return null;
      return {
        url: normalizeUrl(`https://archive.org/services/img/${identifier}`),
        title: String(doc?.title || query),
        creator: String(doc?.creator || "Internet Archive"),
        source: "Internet Archive", provider: "ia",
        license: String(doc?.licenseurl || "unknown"),
        landingUrl: normalizeUrl(`https://archive.org/details/${identifier}`),
      };
    })
    .filter(Boolean) as CandidateImage[];
}

export const iaAdapter: SourceAdapter = {
  name: "ia",
  async fetchCandidates(event: TimelineEvent): Promise<CandidateImage[]> {
    const queries = buildQueries(event);
    const all: CandidateImage[] = [];
    for (const query of queries) {
      try { all.push(...await fetchIaImages(query)); }
      catch (err: any) { console.warn(`    IA query failed for "${query}": ${err?.message || String(err)}`); }
      await sleep(RATE_LIMIT_MS);
    }
    return all;
  },
};
