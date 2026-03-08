/**
 * Fetch WW2 photograph collections from Wikimedia Commons for each event.
 *
 * Uses category members (curated) + free-text search (supplementary) to find
 * 4-8 high-quality historical photographs per event. Stores image metadata
 * (URLs, captions, source attribution) to Firestore as `images: EventImage[]`.
 *
 * Run:  npx tsx src/scripts/fetch-wikimedia-images.ts
 * Flags:
 *   --dry-run          Fetch from Wikimedia but don't write to Firestore
 *   --event=pearl_harbor  Process only a single event
 *   --force            Overwrite images for events that already have them
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import type { EventImage } from "../types/index.ts";

// ── Load .env ──────────────────────────────────────────────────────────────
try {
  const envPath = resolve(import.meta.dirname, "../../.env");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const val = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const baseUrl = (process.env.PROXY_URL || process.env.VITE_PROXY_URL)!;
const token = (process.env.PROXY_TOKEN || process.env.VITE_PROXY_TOKEN)!;

if (!baseUrl || !token) {
  console.error(
    "Missing env vars. Set VITE_PROXY_URL and VITE_PROXY_TOKEN in .env"
  );
  process.exit(1);
}

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  "x-api-key": token,
};

// ── Constants ──────────────────────────────────────────────────────────────

const RATE_LIMIT_MS = 1000;
const TARGET_MAX = 8;
const WIKI_API = "https://commons.wikimedia.org/w/api.php";

// ── Event-to-Search Mapping ────────────────────────────────────────────────

interface EventSearchConfig {
  queries: string[];
  categories: string[];
}

const EVENT_SEARCH_MAP: Record<string, EventSearchConfig> = {
  invasion_poland: {
    queries: ["Invasion of Poland 1939 photograph"],
    categories: ["Invasion_of_Poland_(1939)"],
  },
  britain_declares_war: {
    queries: [
      "Neville Chamberlain 1939 war declaration",
      "Britain World War II 1939",
    ],
    categories: ["United_Kingdom_in_World_War_II"],
  },
  dunkirk: {
    queries: ["Dunkirk evacuation 1940 photograph"],
    categories: ["Battle_of_Dunkirk"],
  },
  battle_of_france: {
    queries: ["Fall of France 1940 German occupation Paris"],
    categories: ["Battle_of_France"],
  },
  battle_of_britain: {
    queries: ["Battle of Britain 1940 RAF Spitfire photograph"],
    categories: ["Battle_of_Britain"],
  },
  lend_lease: {
    queries: [
      "Lend-Lease Act 1941",
      "Lend-Lease military supplies World War II",
    ],
    categories: ["Lend-Lease_program"],
  },
  barbarossa: {
    queries: ["Operation Barbarossa 1941 photograph"],
    categories: ["Operation_Barbarossa"],
  },
  pearl_harbor: {
    queries: ["Attack on Pearl Harbor 1941 photograph"],
    categories: ["Attack_on_Pearl_Harbor"],
  },
  us_declares_war: {
    queries: [
      "Roosevelt war declaration 1941 Congress",
      "Franklin Roosevelt December 1941",
    ],
    categories: ["United_States_declaration_of_war_upon_Japan"],
  },
  midway: {
    queries: ["Battle of Midway 1942 photograph"],
    categories: ["Battle_of_Midway"],
  },
  stalingrad: {
    queries: ["Battle of Stalingrad 1942 1943 photograph"],
    categories: ["Battle_of_Stalingrad"],
  },
  rationing: {
    queries: [
      "World War II rationing United States",
      "ration book 1942 America",
    ],
    categories: ["Rationing_in_the_United_States_during_World_War_II"],
  },
  manhattan_project: {
    queries: ["Manhattan Project photograph", "Los Alamos 1940s laboratory"],
    categories: ["Manhattan_Project"],
  },
  guadalcanal: {
    queries: ["Battle of Guadalcanal 1942 Marines photograph"],
    categories: ["Guadalcanal_campaign"],
  },
  rosie_riveter: {
    queries: [
      "Rosie the Riveter women factory World War II",
      "women war workers 1940s",
    ],
    categories: ["American_women_in_World_War_II"],
  },
  japanese_internment: {
    queries: ["Japanese American internment 1942 photograph"],
    categories: ["Japanese_American_internment"],
  },
  italy_campaign: {
    queries: ["Allied invasion Sicily Italy 1943 photograph"],
    categories: ["Allied_invasion_of_Sicily"],
  },
  tehran_conference: {
    queries: ["Tehran Conference 1943 Roosevelt Churchill Stalin"],
    categories: ["Tehran_Conference"],
  },
  d_day: {
    queries: ["D-Day Normandy landings 1944 photograph"],
    categories: ["Normandy_landings"],
  },
  liberation_paris: {
    queries: ["Liberation of Paris 1944 photograph"],
    categories: ["Liberation_of_Paris"],
  },
  leyte_gulf: {
    queries: ["Battle of Leyte Gulf 1944 photograph naval"],
    categories: ["Battle_of_Leyte_Gulf"],
  },
  battle_of_bulge: {
    queries: ["Battle of the Bulge 1944 Ardennes photograph"],
    categories: ["Battle_of_the_Bulge"],
  },
  yalta_conference: {
    queries: ["Yalta Conference 1945 photograph"],
    categories: ["Yalta_Conference"],
  },
  iwo_jima: {
    queries: ["Battle of Iwo Jima 1945 photograph Marines"],
    categories: ["Battle_of_Iwo_Jima"],
  },
  ve_day: {
    queries: ["V-E Day 1945 celebration Victory Europe"],
    categories: ["Victory_in_Europe_Day"],
  },
  atomic_bombs: {
    queries: ["Hiroshima atomic bomb 1945", "Nagasaki atomic bomb 1945"],
    categories: ["Atomic_bombings_of_Hiroshima_and_Nagasaki"],
  },
  vj_day: {
    queries: [
      "V-J Day 1945 surrender",
      "Japanese surrender USS Missouri 1945",
    ],
    categories: [
      "Victory_over_Japan_Day",
      "Japanese_Instrument_of_Surrender",
    ],
  },
};

// ── Wikimedia API Functions ────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtml(html: string): string {
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

async function fetchCategoryMembers(
  category: string,
  limit = 30
): Promise<string[]> {
  const url =
    `${WIKI_API}?action=query&list=categorymembers` +
    `&cmtitle=Category:${encodeURIComponent(category)}` +
    `&cmtype=file&cmlimit=${limit}&format=json&origin=*`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    return (data.query?.categorymembers || []).map((m: any) => m.title);
  } catch (err: any) {
    console.warn(`    Category fetch failed (${category}): ${err.message}`);
    return [];
  }
}

async function searchFiles(query: string, limit = 15): Promise<string[]> {
  const url =
    `${WIKI_API}?action=query&list=search&srnamespace=6` +
    `&srsearch=${encodeURIComponent(query)}` +
    `&srlimit=${limit}&format=json&origin=*`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    return (data.query?.search || []).map((s: any) => s.title);
  } catch (err: any) {
    console.warn(`    Search failed ("${query}"): ${err.message}`);
    return [];
  }
}

interface WikiImageInfo {
  title: string;
  url: string;
  descriptionUrl: string;
  width: number;
  height: number;
  mime: string;
  description: string;
  license: string;
}

async function fetchImageInfo(fileTitles: string[]): Promise<WikiImageInfo[]> {
  if (fileTitles.length === 0) return [];

  const titles = fileTitles.join("|");
  const url =
    `${WIKI_API}?action=query&titles=${encodeURIComponent(titles)}` +
    `&prop=imageinfo&iiprop=url|extmetadata|size|mime` +
    `&iiurlwidth=800&format=json&origin=*`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();
    const pages = data.query?.pages || {};
    const results: WikiImageInfo[] = [];

    for (const page of Object.values(pages) as any[]) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const meta = info.extmetadata || {};
      results.push({
        title: page.title || "",
        url: info.thumburl || info.url,
        descriptionUrl: info.descriptionurl || "",
        width: info.width || 0,
        height: info.height || 0,
        mime: info.mime || "",
        description: stripHtml(meta.ImageDescription?.value || ""),
        license: meta.LicenseShortName?.value || "Public domain",
      });
    }
    return results;
  } catch (err: any) {
    console.warn(`    ImageInfo fetch failed: ${err.message}`);
    return [];
  }
}

// ── Quality Filter ─────────────────────────────────────────────────────────

function isQualityPhotograph(img: WikiImageInfo): boolean {
  // Only JPEG and PNG
  const validMime = ["image/jpeg", "image/png"];
  if (!validMime.includes(img.mime.toLowerCase())) return false;

  // Minimum dimensions
  if (img.width < 400 || img.height < 300) return false;

  // Sane aspect ratio
  const ratio = img.width / img.height;
  if (ratio < 0.3 || ratio > 4.0) return false;

  // Filename exclusion
  const lowerTitle = img.title.toLowerCase();
  const excludePatterns = [
    "flag",
    "coat_of_arms",
    "emblem",
    "logo",
    "icon",
    "medal",
    "map",
    "diagram",
    "chart",
    "plan_of",
    "order_of_battle",
    "insignia",
    "badge",
    "stamp",
    "postage",
    "ribbon",
    ".svg",
    "commons-logo",
    "wikidata",
    "wikipedia",
    "wikimedia",
    "portrait_placeholder",
  ];
  if (excludePatterns.some((p) => lowerTitle.includes(p))) return false;

  // Description exclusion
  const lowerDesc = img.description.toLowerCase();
  const descExclude = [
    "map of",
    "diagram of",
    "chart showing",
    "coat of arms",
    "battle plan",
  ];
  if (descExclude.some((p) => lowerDesc.includes(p))) return false;

  return true;
}

// ── Per-Event Orchestration ────────────────────────────────────────────────

async function fetchImagesForEvent(
  eventId: string,
  config: EventSearchConfig
): Promise<EventImage[]> {
  const allFileTitles = new Set<string>();

  // Step 1: Fetch from categories (primary, higher quality)
  for (const category of config.categories) {
    console.log(`    Category: ${category}`);
    const titles = await fetchCategoryMembers(category, 30);
    titles.forEach((t) => allFileTitles.add(t));
    await sleep(RATE_LIMIT_MS);
  }
  console.log(`    ${allFileTitles.size} files from categories`);

  // Step 2: Supplement with search if categories yielded few results
  if (allFileTitles.size < TARGET_MAX * 2) {
    for (const query of config.queries) {
      const titles = await searchFiles(query, 15);
      titles.forEach((t) => allFileTitles.add(t));
      await sleep(RATE_LIMIT_MS);
    }
    console.log(
      `    ${allFileTitles.size} total files after search supplement`
    );
  }

  if (allFileTitles.size === 0) {
    return [];
  }

  // Step 3: Fetch image metadata (batch up to 50)
  const titleArray = Array.from(allFileTitles);
  const allImageInfo: WikiImageInfo[] = [];

  for (let i = 0; i < titleArray.length; i += 50) {
    const batch = titleArray.slice(i, i + 50);
    const infos = await fetchImageInfo(batch);
    allImageInfo.push(...infos);
    if (i + 50 < titleArray.length) await sleep(RATE_LIMIT_MS);
  }

  // Step 4: Filter for quality photographs
  const photos = allImageInfo.filter(isQualityPhotograph);
  console.log(
    `    ${photos.length} quality photographs (from ${allImageInfo.length} total)`
  );

  // Step 5: Sort by quality heuristic
  photos.sort((a, b) => {
    // Prefer images with descriptions
    const aDesc = a.description.length > 10 ? 1 : 0;
    const bDesc = b.description.length > 10 ? 1 : 0;
    if (bDesc !== aDesc) return bDesc - aDesc;
    // Then by pixel area (larger = higher quality)
    return b.width * b.height - a.width * a.height;
  });

  // Step 6: Take top TARGET_MAX
  const selected = photos.slice(0, TARGET_MAX);

  // Step 7: Convert to EventImage format
  return selected.map((img) => ({
    url: img.url,
    caption:
      img.description ||
      img.title
        .replace("File:", "")
        .replace(/_/g, " ")
        .replace(/\.\w+$/, ""),
    source: `Wikimedia Commons (${img.license})`,
  }));
}

// ── Firestore Helpers ──────────────────────────────────────────────────────

async function eventHasImages(eventId: string): Promise<boolean> {
  try {
    const resp = await fetch(
      `${baseUrl}/firestore/topics/ww2/events/${eventId}`,
      { method: "GET", headers }
    );
    if (!resp.ok) return false;
    const data = await resp.json();
    const event = data.data || data;
    return Array.isArray(event.images) && event.images.length > 0;
  } catch {
    return false;
  }
}

async function saveImagesToFirestore(
  eventId: string,
  images: EventImage[]
): Promise<boolean> {
  try {
    const resp = await fetch(
      `${baseUrl}/firestore/topics/ww2/events/${eventId}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({ data: { images } }),
      }
    );
    return resp.ok;
  } catch (err: any) {
    console.error(`    Firestore write failed: ${err.message}`);
    return false;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const forceRefresh = process.argv.includes("--force");
  const singleEvent = process.argv.find((a) => a.startsWith("--event="));
  const eventFilter = singleEvent ? singleEvent.split("=")[1] : null;
  const dryRun = process.argv.includes("--dry-run");

  console.log("\n  Wikimedia Commons Image Fetcher");
  console.log("  ================================\n");
  if (forceRefresh) console.log("  Mode: --force (overwriting existing)\n");
  if (dryRun) console.log("  Mode: --dry-run (no Firestore writes)\n");
  if (eventFilter) console.log(`  Filter: --event=${eventFilter}\n`);

  const eventIds = eventFilter ? [eventFilter] : Object.keys(EVENT_SEARCH_MAP);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const eventId of eventIds) {
    const config = EVENT_SEARCH_MAP[eventId];
    if (!config) {
      console.warn(`  No search config for "${eventId}", skipping.`);
      failCount++;
      continue;
    }

    console.log(`  [${eventId}]`);

    // Idempotency check
    if (!forceRefresh && !dryRun) {
      const hasImages = await eventHasImages(eventId);
      if (hasImages) {
        console.log(`    Already has images, skipping. (--force to overwrite)`);
        skipCount++;
        continue;
      }
      await sleep(300);
    }

    try {
      const images = await fetchImagesForEvent(eventId, config);

      if (images.length === 0) {
        console.log(`    No suitable photographs found.`);
        failCount++;
        continue;
      }

      console.log(`    Selected ${images.length} photographs`);

      if (dryRun) {
        images.forEach((img, i) => {
          console.log(
            `      ${i + 1}. ${(img.caption || "").slice(0, 70)}...`
          );
        });
        successCount++;
        continue;
      }

      const saved = await saveImagesToFirestore(eventId, images);
      if (saved) {
        console.log(`    Saved to Firestore.`);
        successCount++;
      } else {
        console.log(`    Firestore save FAILED.`);
        failCount++;
      }
      await sleep(300);
    } catch (err: any) {
      console.error(`    Error: ${err.message}`);
      failCount++;
    }

    console.log();
  }

  console.log("  ================================");
  console.log(
    `  Done: ${successCount} succeeded, ${skipCount} skipped, ${failCount} failed`
  );
  console.log();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
