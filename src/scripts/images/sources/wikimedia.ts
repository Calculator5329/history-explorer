import type { TimelineEvent } from "../../../types/index.ts";
import type { CandidateImage, SourceAdapter } from "../types.ts";
import { sleep, stripHtml } from "../utils.ts";
import { RATE_LIMIT_MS } from "../config.ts";

const WIKI_API = "https://commons.wikimedia.org/w/api.php";

interface EventSearchConfig {
  queries: string[];
  categories: string[];
}

// Curated category + query map for high-quality Wikimedia results
const EVENT_SEARCH_MAP: Record<string, EventSearchConfig> = {
  invasion_poland: { queries: ["Invasion of Poland 1939 photograph"], categories: ["Invasion_of_Poland_(1939)"] },
  britain_declares_war: { queries: ["Neville Chamberlain 1939 war declaration", "Britain World War II 1939"], categories: ["United_Kingdom_in_World_War_II"] },
  dunkirk: { queries: ["Dunkirk evacuation 1940 photograph"], categories: ["Battle_of_Dunkirk"] },
  battle_of_france: { queries: ["Fall of France 1940 German occupation Paris"], categories: ["Battle_of_France"] },
  battle_of_britain: { queries: ["Battle of Britain 1940 RAF Spitfire photograph"], categories: ["Battle_of_Britain"] },
  lend_lease: { queries: ["Lend-Lease Act 1941", "Lend-Lease military supplies World War II"], categories: ["Lend-Lease_program"] },
  barbarossa: { queries: ["Operation Barbarossa 1941 photograph"], categories: ["Operation_Barbarossa"] },
  pearl_harbor: { queries: ["Attack on Pearl Harbor 1941 photograph"], categories: ["Attack_on_Pearl_Harbor"] },
  us_declares_war: { queries: ["Roosevelt war declaration 1941 Congress", "Franklin Roosevelt December 1941"], categories: ["United_States_declaration_of_war_upon_Japan"] },
  midway: { queries: ["Battle of Midway 1942 photograph"], categories: ["Battle_of_Midway"] },
  stalingrad: { queries: ["Battle of Stalingrad 1942 1943 photograph"], categories: ["Battle_of_Stalingrad"] },
  rationing: { queries: ["World War II rationing United States", "ration book 1942 America"], categories: ["Rationing_in_the_United_States_during_World_War_II"] },
  manhattan_project: { queries: ["Manhattan Project photograph", "Los Alamos 1940s laboratory"], categories: ["Manhattan_Project"] },
  guadalcanal: { queries: ["Battle of Guadalcanal 1942 Marines photograph"], categories: ["Guadalcanal_campaign"] },
  rosie_riveter: { queries: ["Rosie the Riveter women factory World War II", "women war workers 1940s"], categories: ["American_women_in_World_War_II"] },
  japanese_internment: { queries: ["Japanese American internment 1942 photograph"], categories: ["Japanese_American_internment"] },
  italy_campaign: { queries: ["Allied invasion Sicily Italy 1943 photograph"], categories: ["Allied_invasion_of_Sicily"] },
  tehran_conference: { queries: ["Tehran Conference 1943 Roosevelt Churchill Stalin"], categories: ["Tehran_Conference"] },
  d_day: { queries: ["D-Day Normandy landings 1944 photograph"], categories: ["Normandy_landings"] },
  liberation_paris: { queries: ["Liberation of Paris 1944 photograph"], categories: ["Liberation_of_Paris"] },
  leyte_gulf: { queries: ["Battle of Leyte Gulf 1944 photograph naval"], categories: ["Battle_of_Leyte_Gulf"] },
  battle_of_bulge: { queries: ["Battle of the Bulge 1944 Ardennes photograph"], categories: ["Battle_of_the_Bulge"] },
  yalta_conference: { queries: ["Yalta Conference 1945 photograph"], categories: ["Yalta_Conference"] },
  iwo_jima: { queries: ["Battle of Iwo Jima 1945 photograph Marines"], categories: ["Battle_of_Iwo_Jima"] },
  ve_day: { queries: ["V-E Day 1945 celebration Victory Europe"], categories: ["Victory_in_Europe_Day"] },
  atomic_bombs: { queries: ["Hiroshima atomic bomb 1945", "Nagasaki atomic bomb 1945"], categories: ["Atomic_bombings_of_Hiroshima_and_Nagasaki"] },
  vj_day: { queries: ["V-J Day 1945 surrender", "Japanese surrender USS Missouri 1945"], categories: ["Victory_over_Japan_Day", "Japanese_Instrument_of_Surrender"] },
};

async function fetchCategoryMembers(category: string, limit = 30): Promise<string[]> {
  const url = `${WIKI_API}?action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(category)}&cmtype=file&cmlimit=${limit}&format=json&origin=*`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    return (data.query?.categorymembers || []).map((m: any) => m.title);
  } catch { return []; }
}

async function searchFiles(query: string, limit = 15): Promise<string[]> {
  const url = `${WIKI_API}?action=query&list=search&srnamespace=6&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&format=json&origin=*`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    return (data.query?.search || []).map((s: any) => s.title);
  } catch { return []; }
}

interface WikiImageInfo {
  title: string; url: string; descriptionUrl: string;
  width: number; height: number; mime: string;
  description: string; license: string;
}

async function fetchImageInfo(fileTitles: string[]): Promise<WikiImageInfo[]> {
  if (fileTitles.length === 0) return [];
  const titles = fileTitles.join("|");
  const url = `${WIKI_API}?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=800&format=json&origin=*`;
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
        title: page.title || "", url: info.thumburl || info.url,
        descriptionUrl: info.descriptionurl || "",
        width: info.width || 0, height: info.height || 0,
        mime: info.mime || "",
        description: stripHtml(meta.ImageDescription?.value || ""),
        license: meta.LicenseShortName?.value || "Public domain",
      });
    }
    return results;
  } catch { return []; }
}

export const wikimediaAdapter: SourceAdapter = {
  name: "wikimedia",
  async fetchCandidates(event: TimelineEvent): Promise<CandidateImage[]> {
    const config = EVENT_SEARCH_MAP[event.id];
    const allFileTitles = new Set<string>();

    // Use curated categories if available, otherwise generate search queries
    const categories = config?.categories || [];
    const queries = config?.queries || [
      `${event.wikipediaSearchQuery || event.title} photograph`,
      `${event.title} World War II`,
    ];

    for (const category of categories) {
      const titles = await fetchCategoryMembers(category, 30);
      titles.forEach((t) => allFileTitles.add(t));
      await sleep(RATE_LIMIT_MS);
    }

    if (allFileTitles.size < 16) {
      for (const query of queries) {
        const titles = await searchFiles(query, 15);
        titles.forEach((t) => allFileTitles.add(t));
        await sleep(RATE_LIMIT_MS);
      }
    }

    if (allFileTitles.size === 0) return [];

    // Fetch metadata in batches of 50
    const titleArray = Array.from(allFileTitles);
    const allInfo: WikiImageInfo[] = [];
    for (let i = 0; i < titleArray.length; i += 50) {
      const batch = titleArray.slice(i, i + 50);
      allInfo.push(...await fetchImageInfo(batch));
      if (i + 50 < titleArray.length) await sleep(RATE_LIMIT_MS);
    }

    // Filter valid MIME types
    const validMime = ["image/jpeg", "image/png"];

    return allInfo
      .filter((img) => validMime.includes(img.mime.toLowerCase()))
      .map((img) => ({
        url: img.url,
        title: img.description || img.title.replace("File:", "").replace(/_/g, " ").replace(/\.\w+$/, ""),
        source: "Wikimedia Commons",
        provider: "wikimedia",
        license: img.license,
        width: img.width,
        height: img.height,
        landingUrl: img.descriptionUrl,
      }));
  },
};
