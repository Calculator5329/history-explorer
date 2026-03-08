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

export async function readJsonOrThrow(resp: Response, provider: string): Promise<any> {
  const contentType = (resp.headers.get("content-type") || "").toLowerCase();
  const text = await resp.text();
  if (!resp.ok) throw new Error(`${provider}:${resp.status}`);
  if (!contentType.includes("json") || text.trimStart().startsWith("<")) {
    throw new Error(`${provider}:${resp.status}:unexpected HTML response`);
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
