/**
 * Backfill the `region` field to Firestore for all WW2 events.
 *
 * Run:  npx tsx src/scripts/backfill-regions.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { sampleEvents } from "../data/ww2-sample.ts";

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
  console.error("Missing env vars. Set VITE_PROXY_URL and VITE_PROXY_TOKEN in .env");
  process.exit(1);
}

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  "x-api-key": token,
};

async function main() {
  console.log("\n  Backfill regions to Firestore");
  console.log("  ==============================\n");

  let updated = 0;
  let skipped = 0;

  for (const event of sampleEvents) {
    if (!event.region) {
      console.log(`  ⏭  ${event.id} — no region in sample data`);
      skipped++;
      continue;
    }

    try {
      const resp = await fetch(
        `${baseUrl}/firestore/topics/ww2/events/${event.id}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ data: { region: event.region } }),
        }
      );

      if (resp.ok) {
        console.log(`  ✅ ${event.id} → ${event.region}`);
        updated++;
      } else {
        console.error(`  ❌ ${event.id} — HTTP ${resp.status}`);
      }
    } catch (err: any) {
      console.error(`  ❌ ${event.id} — ${err.message}`);
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n  Done: ${updated} updated, ${skipped} skipped\n`);
}

main();
