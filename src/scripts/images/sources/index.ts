import type { SourceAdapter } from "../types.ts";
import { wikimediaAdapter } from "./wikimedia.ts";
import { naraApiAdapter } from "./nara-api.ts";
import { naraCsvAdapter } from "./nara-csv.ts";
import { locAdapter } from "./loc.ts";
import { iaAdapter } from "./internet-archive.ts";
import { openverseAdapter } from "./openverse.ts";
import { flickrAdapter } from "./flickr.ts";

export const ALL_ADAPTERS: Record<string, SourceAdapter> = {
  wikimedia: wikimediaAdapter,
  nara: naraApiAdapter,
  "nara-csv": naraCsvAdapter,
  loc: locAdapter,
  ia: iaAdapter,
  openverse: openverseAdapter,
  flickr: flickrAdapter,
};

export function getAdapters(sources: Set<string>): SourceAdapter[] {
  if (sources.has("all")) return Object.values(ALL_ADAPTERS);
  return [...sources].map((s) => ALL_ADAPTERS[s]).filter(Boolean);
}

export { buildCsvIndex } from "./nara-csv.ts";
