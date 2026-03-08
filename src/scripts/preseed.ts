import { createClient } from "@calculator-5329/cloud-proxy";
import { readFileSync } from "fs";
import { resolve } from "path";
import { sampleTopic, sampleEvents } from "../data/ww2-sample.ts";

// Load .env
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
  console.error("Missing env vars. Set VITE_PROXY_URL and VITE_PROXY_TOKEN in .env");
  process.exit(1);
}

const headers = { "Content-Type": "application/json", "x-api-key": token };

async function preseed() {
  console.log("Starting WW2 pre-seed using sample data...");
  console.log(`${sampleEvents.length} events to write.\n`);

  // Step 1: Update topic doc with branches via PUT (merge)
  console.log("--- Step 1: Updating topic with branches ---");
  try {
    const resp = await fetch(`${baseUrl}/firestore/topics/ww2`, {
      method: "PUT", headers,
      body: JSON.stringify({
        data: {
          name: sampleTopic.name,
          description: sampleTopic.description,
          branches: sampleTopic.branches,
        },
      }),
    });
    const body = await resp.json();
    if (resp.ok) {
      console.log("Topic updated with branches.");
    } else {
      console.warn("Topic update response:", JSON.stringify(body));
    }
  } catch (err: any) {
    console.warn("Topic update failed:", err.message);
  }

  // Step 2: Write events using batch API (bypasses path resolution issues)
  console.log("\n--- Step 2: Writing events via batch ---");

  // Batch in groups of 20 (Firestore batch limit is 500, but keep it safe)
  const BATCH_SIZE = 20;
  const allIds: string[] = [];

  for (let i = 0; i < sampleEvents.length; i += BATCH_SIZE) {
    const batch = sampleEvents.slice(i, i + BATCH_SIZE);
    const operations = batch.map((event) => ({
      type: "create" as const,
      collection: "topics/ww2/events",
      docId: event.id,
      data: {
        title: event.title,
        date: event.date,
        endDate: event.endDate || null,
        branch: event.branch,
        importance: event.importance,
        eventType: event.eventType || null,
        region: event.region || null,
        summary: event.summary,
        sources: [],
        connections: event.connections,
        generatedBy: "preseed",
        enriched: false,
        wikipediaSearchQuery: event.title,
      },
    }));

    try {
      const resp = await fetch(`${baseUrl}/firestore/batch`, {
        method: "POST", headers,
        body: JSON.stringify({ operations }),
      });
      const body = await resp.json();
      if (resp.ok) {
        console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} events written`);
        allIds.push(...batch.map((e) => e.id));
      } else {
        console.error(`  Batch failed:`, JSON.stringify(body));
      }
    } catch (err: any) {
      console.error(`  Batch error:`, err.message);
    }
  }

  console.log(`\nWrote ${allIds.length} events.`);

  // Step 3: Enrich events (Wikipedia + search)
  if (allIds.length === 0) {
    console.log("No events to enrich. Exiting.");
    return;
  }

  console.log("\n--- Step 3: Enriching events ---");
  console.log("This may take a few minutes...\n");

  const proxy = createClient({ baseUrl, token, timeout: 60000 });

  for (const event of sampleEvents) {
    if (!allIds.includes(event.id)) continue;

    try {
      await (proxy.agent as any).enrichEvent({
        timelineId: "ww2",
        eventId: event.id,
        event: {
          title: event.title,
          date: event.date,
          wikipedia_search_query: event.title,
        },
      });
      console.log(`  Enriched: ${event.title}`);
    } catch (err: any) {
      console.warn(`  Failed to enrich ${event.title}: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\nPre-seed complete! Run 'npm run dev' to see the timeline.");
}

preseed().catch(console.error);
