import { createClient } from "@calculator-5329/cloud-proxy";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env file manually (no dotenv dependency needed)
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

const baseUrl = process.env.PROXY_URL || process.env.VITE_PROXY_URL;
const token = process.env.PROXY_TOKEN || process.env.VITE_PROXY_TOKEN;

if (!baseUrl || !token) {
  console.error("Missing PROXY_URL/VITE_PROXY_URL or PROXY_TOKEN/VITE_PROXY_TOKEN");
  console.error("Set them in .env or as environment variables.");
  process.exit(1);
}

const proxy = createClient({ baseUrl, token });

const WW2_BRANCHES = [
  { id: "european", name: "European Theater", color: "#4A90D9" },
  { id: "pacific", name: "Pacific Theater", color: "#E74C3C" },
  { id: "homefront", name: "Home Front", color: "#2ECC71" },
  { id: "diplomacy", name: "Diplomacy & Politics", color: "#F39C12" },
];

const GENERATION_PROMPT = `Generate a comprehensive World War II timeline with 50-60 key events across these branches:
- european: European Theater (military operations in Europe and North Africa)
- pacific: Pacific Theater (military operations in the Pacific and Asia)
- homefront: Home Front (civilian life, manufacturing, social changes)
- diplomacy: Diplomacy & Politics (conferences, declarations, treaties)

Return ONLY a JSON array. Each event object must have:
- title: string (concise event name)
- date: string (ISO format YYYY-MM-DD, use best known date)
- endDate: string or null (for events spanning multiple days)
- branch: string (one of: european, pacific, homefront, diplomacy)
- importance: string (one of: critical, major, standard, minor)
  - critical: ~10 events that fundamentally changed the war's course
  - major: ~15 events of significant military or political importance
  - standard: ~15 notable events
  - minor: ~10 smaller but interesting events
- summary: string (1-2 sentences, factual)
- wikipediaSearchQuery: string (exact Wikipedia article title for this event)
- connections: string[] (titles of other events in this list that are directly related)

Be historically accurate. Cover the full span of the war (1939-1945). Ensure good coverage across all four branches.`;

async function preseed() {
  console.log("Starting WW2 pre-seed...");

  // Step 1: Create the topic document
  console.log("Creating topic document...");
  const topicData = {
    name: "World War II",
    description: "The Second World War, 1939-1945. The deadliest conflict in human history.",
    createdAt: new Date().toISOString(),
    branches: WW2_BRANCHES,
  };

  let topicExists = false;
  try {
    await (proxy.firestore as any).get("topics/ww2");
    topicExists = true;
  } catch {
    topicExists = false;
  }

  if (topicExists) {
    console.log("Topic already exists, patching...");
    try {
      await (proxy.firestore as any).patch("topics/ww2", topicData);
      console.log("Topic patched successfully.");
    } catch (patchErr) {
      console.warn("Patch failed (non-critical, continuing):", (patchErr as Error).message);
    }
  } else {
    console.log("Creating new topic with ID 'ww2'...");
    await (proxy.firestore as any).create("topics", topicData, "ww2");
    console.log("Topic created successfully.");
  }

  // Step 2: Generate events via LLM
  console.log("Generating events via LLM...");
  const response = await (proxy.ai as any).chat({
    provider: "openai",
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a historian. Return only valid JSON, no markdown fences, no explanation.",
      },
      { role: "user", content: GENERATION_PROMPT },
    ],
    maxTokens: 8000,
  });

  let events: Array<{
    title: string;
    date: string;
    endDate?: string;
    branch: string;
    importance: string;
    summary: string;
    wikipediaSearchQuery: string;
    connections: string[];
  }>;

  try {
    const cleaned = response.content.replace(/```json\n?|```\n?/g, "").trim();
    events = JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse LLM response:", err);
    console.error("Raw response:", response.content);
    process.exit(1);
  }

  console.log(`Generated ${events.length} events. Writing to Firestore...`);

  // Step 3: Write events to Firestore
  const titleToId = new Map<string, string>();

  for (const event of events) {
    const doc = await (proxy.firestore as any).create(`topics/ww2/events`, {
      title: event.title,
      date: event.date,
      endDate: event.endDate || null,
      branch: event.branch,
      importance: event.importance,
      summary: event.summary,
      sources: [],
      connections: [],
      generatedBy: "preseed",
      enriched: false,
      wikipediaSearchQuery: event.wikipediaSearchQuery,
    });

    titleToId.set(event.title, doc.id);
    console.log(`  Created: ${event.title} (${doc.id})`);
  }

  // Second pass: resolve connections
  console.log("Resolving connections...");
  for (const event of events) {
    const eventId = titleToId.get(event.title);
    if (!eventId) continue;

    const connectionIds = event.connections
      .map((title) => titleToId.get(title))
      .filter((id): id is string => id !== undefined);

    if (connectionIds.length > 0) {
      await (proxy.firestore as any).patch(`topics/ww2/events/${eventId}`, {
        connections: connectionIds,
      });
    }
  }

  // Step 4: Enrich events
  console.log("Enriching events (this may take a few minutes)...");
  for (const event of events) {
    const eventId = titleToId.get(event.title);
    if (!eventId) continue;

    try {
      await (proxy.agent as any).enrichEvent({
        timelineId: "ww2",
        eventId,
        event: {
          title: event.title,
          date: event.date,
          wikipedia_search_query: event.wikipediaSearchQuery,
        },
      });
      console.log(`  Enriched: ${event.title}`);
    } catch (err) {
      console.warn(`  Failed to enrich ${event.title}:`, err);
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("Pre-seed complete!");
}

preseed().catch(console.error);
