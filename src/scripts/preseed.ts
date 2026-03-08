import { createClient } from "@calculator-5329/cloud-proxy";
import { readFileSync } from "fs";
import { resolve } from "path";
import { sampleTopic, sampleEvents } from "../data/ww2-sample.ts";

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

const proxy = createClient({ baseUrl, token, timeout: 120000 });

async function preseed() {
  console.log("Starting WW2 pre-seed using sample data...");
  console.log(`${sampleEvents.length} events to write across ${sampleTopic.branches.length} branches.`);

  // Step 1: Create/update the topic document
  console.log("\n--- Step 1: Topic document ---");
  const topicData = {
    name: sampleTopic.name,
    description: sampleTopic.description,
    createdAt: new Date().toISOString(),
    branches: sampleTopic.branches,
  };

  let topicExists = false;
  try {
    await (proxy.firestore as any).get("topics/ww2");
    topicExists = true;
  } catch {
    topicExists = false;
  }

  if (topicExists) {
    console.log("Topic already exists, skipping creation.");
  } else {
    console.log("Creating topic 'ww2'...");
    try {
      await (proxy.firestore as any).create("topics", topicData, "ww2");
      console.log("Topic created.");
    } catch (err) {
      console.warn("Create with docId failed, trying without:", (err as Error).message);
      await (proxy.firestore as any).create("topics", { ...topicData, _id: "ww2" });
    }
  }

  // Step 2: Write events to Firestore
  console.log("\n--- Step 2: Writing events ---");
  const idMap = new Map<string, string>();

  for (const event of sampleEvents) {
    try {
      const doc = await (proxy.firestore as any).create(`topics/ww2/events`, {
        title: event.title,
        date: event.date,
        endDate: event.endDate || null,
        branch: event.branch,
        importance: event.importance,
        summary: event.summary,
        content: event.content || null,
        sources: [],
        connections: [], // resolve in next pass
        generatedBy: "preseed",
        enriched: false,
        wikipediaSearchQuery: event.title,
      }, event.id);

      idMap.set(event.id, doc.id);
      console.log(`  Created: ${event.title} (${doc.id})`);
    } catch (err) {
      console.error(`  Failed to create ${event.title}:`, (err as Error).message);
    }
  }

  // Step 3: Resolve connections (sample data uses our local IDs)
  console.log("\n--- Step 3: Resolving connections ---");
  for (const event of sampleEvents) {
    if (event.connections.length === 0) continue;

    const docId = idMap.get(event.id);
    if (!docId) continue;

    // Map local IDs to Firestore IDs
    const resolvedConnections = event.connections
      .map((connId) => idMap.get(connId))
      .filter((id): id is string => id !== undefined);

    if (resolvedConnections.length > 0) {
      try {
        await (proxy.firestore as any).patch(`topics/ww2/events/${docId}`, {
          connections: resolvedConnections,
        });
        console.log(`  ${event.title}: ${resolvedConnections.length} connections`);
      } catch (err) {
        console.warn(`  Failed to patch connections for ${event.title}:`, (err as Error).message);
      }
    }
  }

  // Step 4: Enrich events (Wikipedia + search)
  console.log("\n--- Step 4: Enriching events ---");
  console.log("This may take a few minutes...");

  for (const event of sampleEvents) {
    const docId = idMap.get(event.id);
    if (!docId) continue;

    try {
      await (proxy.agent as any).enrichEvent({
        timelineId: "ww2",
        eventId: docId,
        event: {
          title: event.title,
          date: event.date,
          wikipedia_search_query: event.title,
        },
      });
      console.log(`  Enriched: ${event.title}`);
    } catch (err) {
      console.warn(`  Failed to enrich ${event.title}:`, (err as Error).message);
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\nPre-seed complete!");
  console.log(`Wrote ${idMap.size} events. Run 'npm run dev' to see them.`);
}

preseed().catch(console.error);
