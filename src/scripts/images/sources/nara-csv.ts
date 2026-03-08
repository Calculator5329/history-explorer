import { createReadStream } from "fs";
import { createInterface } from "readline";
import type { TimelineEvent } from "../../../types/index.ts";
import type { CandidateImage, CsvImageRow, SourceAdapter, SourceOptions } from "../types.ts";
import { normalizeUrl, splitCsvLine, tokenize } from "../utils.ts";

/**
 * Stream-parse a large NARA CSV export and build an index of matching rows.
 * The CSV can be many GB — we never load it all into memory.
 */
export async function buildCsvIndex(
  csvPath: string,
  events: TimelineEvent[]
): Promise<Map<string, CsvImageRow[]>> {
  const index = new Map<string, CsvImageRow[]>();

  // Build keyword sets for each event
  const eventKeywords = new Map<string, { id: string; tokens: Set<string> }>();
  for (const event of events) {
    const tokens = new Set(tokenize(`${event.title} ${event.wikipediaSearchQuery || ""}`));
    if (tokens.size > 0) eventKeywords.set(event.id, { id: event.id, tokens });
  }

  const stream = createReadStream(csvPath, "utf-8");
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let headerMap: Map<string, number> | null = null;
  let rowCount = 0;
  let matchCount = 0;

  for await (const line of rl) {
    if (!headerMap) {
      const headers = splitCsvLine(line);
      headerMap = new Map(headers.map((h, i) => [h, i]));
      continue;
    }

    rowCount++;
    if (rowCount % 500_000 === 0) {
      console.log(`    CSV: processed ${(rowCount / 1_000_000).toFixed(1)}M rows, ${matchCount} matches...`);
    }

    const cols = splitCsvLine(line);
    const titleIdx = headerMap.get("title");
    const urlIdx = headerMap.get("firstDigitalObject.0.objectUrl");
    const objectTypeIdx = headerMap.get("firstDigitalObject.0.objectType");
    const naIdIdx = headerMap.get("naId");

    if (titleIdx === undefined || urlIdx === undefined) continue;

    const title = (cols[titleIdx] || "").trim();
    const url = normalizeUrl(cols[urlIdx] || "");
    if (!title || !url) continue;

    const rowTokens = tokenize(title);
    const hasWw2 = /world\s*war\s*ii|wwii|ww2/i.test(title);

    // Match against each event
    for (const [eventId, { tokens }] of eventKeywords) {
      const overlap = rowTokens.filter((t) => tokens.has(t)).length;
      const score = overlap + (hasWw2 ? 1 : 0);
      if (score < 2) continue;

      const row: CsvImageRow = {
        title, url,
        objectType: objectTypeIdx !== undefined ? (cols[objectTypeIdx] || "").trim() : "",
        naId: naIdIdx !== undefined ? (cols[naIdIdx] || "").trim() : "",
      };

      if (!index.has(eventId)) index.set(eventId, []);
      index.get(eventId)!.push(row);
      matchCount++;
    }
  }

  console.log(`    CSV index built: ${rowCount} rows scanned, ${matchCount} matches across ${index.size} events`);
  return index;
}

export const naraCsvAdapter: SourceAdapter = {
  name: "nara-csv",
  async fetchCandidates(event: TimelineEvent, options?: SourceOptions): Promise<CandidateImage[]> {
    const csvRows = options?.csvIndex?.get(event.id) || [];
    if (csvRows.length === 0) return [];

    // Score and sort matches
    const eventTokens = new Set(tokenize(`${event.title} ${event.wikipediaSearchQuery || ""}`));

    const scored = csvRows
      .map((row) => {
        const rowTokens = tokenize(row.title);
        const overlap = rowTokens.filter((t) => eventTokens.has(t)).length;
        const bonus = /world\s*war\s*ii|wwii|ww2/i.test(row.title) ? 1 : 0;
        const typeBonus = /image|jpg|jpeg|photo/i.test(row.objectType || "") ? 0.5 : 0;
        return { row, score: overlap + bonus + typeBonus };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    return scored.map((entry) => ({
      url: entry.row.url,
      title: entry.row.title,
      creator: "US National Archives",
      source: "US National Archives (CSV import)",
      provider: "nara-csv",
      license: "public domain/varies",
      landingUrl: entry.row.naId ? `https://catalog.archives.gov/id/${entry.row.naId}` : undefined,
    }));
  },
};
