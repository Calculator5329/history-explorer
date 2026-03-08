import type { TimelineEvent } from "../../../types/index.ts";
import type { CandidateImage, SourceAdapter } from "../types.ts";
import { normalizeUrl, buildQueries, readJsonOrThrow, sleep } from "../utils.ts";
import { RATE_LIMIT_MS } from "../config.ts";

const OPENVERSE_API = "https://api.openverse.org/v1/images";
const UA = "Mozilla/5.0 (compatible; history-explorer/1.0)";
let blocked = false;

export const openverseAdapter: SourceAdapter = {
  name: "openverse",
  async fetchCandidates(event: TimelineEvent): Promise<CandidateImage[]> {
    if (blocked) return [];
    const queries = buildQueries(event);
    const all: CandidateImage[] = [];
    for (const query of queries) {
      try {
        const url = `${OPENVERSE_API}?q=${encodeURIComponent(query)}&page_size=25&mature=false&format=json`;
        const resp = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
        const data = await readJsonOrThrow(resp, "openverse");
        const results = Array.isArray(data?.results) ? data.results : [];
        all.push(...results.map((item: any) => ({
          url: normalizeUrl(item?.url), title: item?.title || query,
          creator: item?.creator || "", source: item?.source || "Openverse",
          provider: "openverse", license: item?.license || "unknown",
          width: item?.width, height: item?.height,
          landingUrl: normalizeUrl(item?.foreign_landing_url),
        })));
      } catch (err: any) {
        const msg = String(err?.message || "");
        if (msg.includes("401") || msg.includes("403")) { blocked = true; console.warn(`    Openverse blocked.`); return all; }
        console.warn(`    Openverse query failed: ${msg}`);
      }
      await sleep(RATE_LIMIT_MS);
    }
    return all;
  },
};
