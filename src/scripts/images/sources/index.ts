import type { SourceAdapter } from "../types.ts";
import { wikimediaAdapter } from "./wikimedia.ts";
import { locAdapter } from "./loc.ts";
import { iaAdapter } from "./internet-archive.ts";

export const ALL_ADAPTERS: Record<string, SourceAdapter> = {
  wikimedia: wikimediaAdapter,
  loc: locAdapter,
  ia: iaAdapter,
};

export function getAdapters(sources: Set<string>): SourceAdapter[] {
  if (sources.has("all")) return Object.values(ALL_ADAPTERS);
  return [...sources].map((s) => ALL_ADAPTERS[s]).filter(Boolean);
}
