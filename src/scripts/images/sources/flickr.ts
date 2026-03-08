import type { TimelineEvent } from "../../../types/index.ts";
import type { CandidateImage, SourceAdapter } from "../types.ts";
import { normalizeUrl, buildQueries, readJsonOrThrow, sleep } from "../utils.ts";
import { flickrApiKey, RATE_LIMIT_MS } from "../config.ts";

const FLICKR_REST = "https://www.flickr.com/services/rest";
const FLICKR_FEED = "https://www.flickr.com/services/feeds/photos_public.gne";
const UA = "Mozilla/5.0 (compatible; history-explorer/1.0)";

const FLICKR_LICENSE_MAP: Record<string, string> = {
  "0": "All Rights Reserved", "1": "CC BY-NC-SA 2.0", "2": "CC BY-NC 2.0",
  "3": "CC BY-NC-ND 2.0", "4": "CC BY 2.0", "5": "CC BY-SA 2.0",
  "6": "CC BY-ND 2.0", "7": "No known copyright restrictions",
  "8": "US Gov Work", "9": "CC0", "10": "Public Domain Mark",
};

async function fetchFlickrApi(query: string): Promise<CandidateImage[]> {
  if (!flickrApiKey) return [];
  const params = new URLSearchParams({
    method: "flickr.photos.search", api_key: flickrApiKey, text: query,
    media: "photos", content_type: "1", sort: "relevance", per_page: "30",
    page: "1", safe_search: "1", extras: "url_l,url_c,url_o,owner_name,license,o_dims",
    format: "json", nojsoncallback: "1",
  });
  const resp = await fetch(`${FLICKR_REST}?${params}`, { headers: { "User-Agent": UA, Accept: "application/json" } });
  const data = await readJsonOrThrow(resp, "flickr-api");
  const photos = Array.isArray(data?.photos?.photo) ? data.photos.photo : [];
  return photos.map((p: any) => ({
    url: normalizeUrl(p?.url_l || p?.url_c || p?.url_o || ""),
    title: String(p?.title || query), creator: String(p?.ownername || ""),
    source: "Flickr", provider: "flickr",
    license: FLICKR_LICENSE_MAP[String(p?.license ?? "")] || "unknown",
    width: Number(p?.width_l || p?.width_c || 0) || undefined,
    height: Number(p?.height_l || p?.height_c || 0) || undefined,
    landingUrl: p?.id && p?.owner ? `https://www.flickr.com/photos/${p.owner}/${p.id}` : "",
  })).filter((c: CandidateImage) => !!c.url);
}

async function fetchFlickrFeed(query: string): Promise<CandidateImage[]> {
  const url = `${FLICKR_FEED}?format=json&nojsoncallback=1&tags=${encodeURIComponent(query)}`;
  const resp = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  const data = await readJsonOrThrow(resp, "flickr-feed");
  const items = Array.isArray(data?.items) ? data.items.slice(0, 20) : [];
  return items.map((item: any) => ({
    url: normalizeUrl(item?.media?.m || ""), title: String(item?.title || query),
    creator: String(item?.author || "").replace(/^nobody@flickr\.com \("?|"?\)$/g, ""),
    source: "Flickr Public Feed", provider: "flickr", license: "mixed",
    landingUrl: normalizeUrl(item?.link || ""),
  }));
}

export const flickrAdapter: SourceAdapter = {
  name: "flickr",
  async fetchCandidates(event: TimelineEvent): Promise<CandidateImage[]> {
    const queries = buildQueries(event);
    const all: CandidateImage[] = [];
    for (const query of queries) {
      try {
        const results = flickrApiKey ? await fetchFlickrApi(query) : await fetchFlickrFeed(query);
        all.push(...results);
      } catch (err: any) { console.warn(`    Flickr query failed: ${err?.message || String(err)}`); }
      await sleep(RATE_LIMIT_MS);
    }
    return all;
  },
};
