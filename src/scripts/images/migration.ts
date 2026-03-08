import type { EventImage } from "../../types/index.ts";
import type { PipelineOptions } from "./types.ts";
import { fetchEvents, saveImages } from "./firestore.ts";
import { uploadImageToGcs, isGcsUrl } from "./storage.ts";
import { sleep } from "./utils.ts";

function inferProvider(source?: string): string {
  if (!source) return "unknown";
  const lower = source.toLowerCase();
  if (lower.includes("wikimedia") || lower.includes("wikipedia")) return "wikimedia";
  if (lower.includes("national archives") || lower.includes("nara")) return "nara";
  if (lower.includes("library of congress")) return "loc";
  if (lower.includes("internet archive")) return "ia";
  if (lower.includes("flickr")) return "flickr";
  if (lower.includes("openverse")) return "openverse";
  return "other";
}

export async function runMigration(options: PipelineOptions): Promise<void> {
  console.log("\n  Image Migration (External URLs → GCS)");
  console.log("  ======================================");
  console.log(`  Topic: ${options.topicId}`);
  console.log(`  Mode: ${options.dryRun ? "dry-run" : "write"}\n`);

  const events = await fetchEvents(options.topicId);
  let migrated = 0;
  let skipped = 0;
  let totalImages = 0;

  for (const event of events) {
    if (!event.images || event.images.length === 0) continue;

    const externalImages = event.images.filter((img) => !isGcsUrl(img.url));
    if (externalImages.length === 0) {
      continue; // All already on GCS
    }

    console.log(`  [${event.id}] ${event.title} — ${externalImages.length} external images`);

    if (options.dryRun) {
      for (const img of externalImages) {
        console.log(`    Would migrate: ${img.url.slice(0, 80)}...`);
      }
      migrated++;
      continue;
    }

    const newImages: EventImage[] = [];
    let changed = false;

    for (let i = 0; i < event.images.length; i++) {
      const img = event.images[i];

      if (isGcsUrl(img.url)) {
        newImages.push(img);
        continue;
      }

      const provider = inferProvider(img.source);
      const uploaded = await uploadImageToGcs(
        { url: img.url, title: img.caption, source: img.source || "", provider },
        options.topicId, event.id, i
      );

      if (uploaded) {
        newImages.push({ url: uploaded.publicUrl, caption: img.caption, source: img.source });
        changed = true;
        totalImages++;
      } else {
        newImages.push(img); // Keep original if download fails
      }
      await sleep(300);
    }

    if (changed) {
      await saveImages(options.topicId, event.id, newImages);
      console.log(`    Migrated ${newImages.filter((img) => isGcsUrl(img.url)).length} images.`);
      migrated++;
    } else {
      skipped++;
    }
  }

  console.log("\n  ======================================");
  console.log(`  Done: ${migrated} events migrated, ${totalImages} images uploaded, ${skipped} skipped\n`);
}
