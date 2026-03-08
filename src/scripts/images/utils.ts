export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeUrl(value?: string): string {
  if (!value) return "";
  try {
    const parsed = new URL(value.trim());
    parsed.hash = "";
    return parsed.href;
  } catch {
    return "";
  }
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) { out.push(current); current = ""; continue; }
    current += char;
  }
  out.push(current);
  return out;
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 2);
}

export function buildQueries(event: { title: string; summary?: string; wikipediaSearchQuery?: string }): string[] {
  const summaryWords = (event.summary || "").split(/\s+/).slice(0, 8).join(" ");
  const primary = event.wikipediaSearchQuery || event.title;
  const raw = [
    `${primary} historical photograph`,
    `${event.title} ${summaryWords}`.trim(),
  ];
  const seen = new Set<string>();
  return raw.filter((q) => {
    const cleaned = q.replace(/\s+/g, " ").trim().toLowerCase();
    if (!cleaned || seen.has(cleaned)) return false;
    seen.add(cleaned);
    return true;
  });
}

export function pickStringValues(obj: unknown, keys: string[], maxValues = 8): string[] {
  const out: string[] = [];
  const walk = (node: unknown, depth: number) => {
    if (depth > 7 || out.length >= maxValues) return;
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { for (const item of node) walk(item, depth + 1); return; }
    const record = node as Record<string, unknown>;
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) out.push(value.trim());
      if (Array.isArray(value)) {
        for (const candidate of value) {
          if (typeof candidate === "string" && candidate.trim()) out.push(candidate.trim());
        }
      }
    }
    for (const value of Object.values(record)) walk(value, depth + 1);
  };
  walk(obj, 0);
  const seen = new Set<string>();
  return out.filter((v) => { if (seen.has(v)) return false; seen.add(v); return true; }).slice(0, maxValues);
}

export async function readJsonOrThrow(resp: Response, provider: string): Promise<any> {
  const contentType = (resp.headers.get("content-type") || "").toLowerCase();
  const text = await resp.text();
  if (!resp.ok) throw new Error(`${provider}:${resp.status}`);
  if (!contentType.includes("json") || text.trimStart().startsWith("<")) {
    throw new Error(`${provider}:${resp.status}:HTML response (v1 may be deprecated; add NARA_API_KEY to .env for v2 API)`);
  }
  try { return JSON.parse(text); }
  catch { throw new Error(`${provider}:${resp.status}:invalid-json`); }
}

export function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const fromEqArg = process.argv.find((arg) => arg.startsWith(prefix));
  if (fromEqArg) return fromEqArg.slice(prefix.length);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith("--")) {
    return process.argv[idx + 1];
  }
  return undefined;
}

export function parseFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
