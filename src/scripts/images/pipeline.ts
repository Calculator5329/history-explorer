import type { TimelineEvent, EventImage } from "../../types/index.ts";
import type { PipelineOptions, CandidateImage, CsvImageRow } from "./types.ts";
import { getAdapters, buildCsvIndex } from "./sources/index.ts";
import { filterAndRank } from "./filters.ts";
import { uploadImageToGcs, isGcsUrl } from "./storage.ts";
import { fetchEvents, saveImages, eventHasGcsImages } from "./firestore.ts";
import { sleep } from "./utils.ts";
import { RATE_LIMIT_MS } from "./config.ts";

function toEventImage(publicUrl: string, candidate: CandidateImage): EventImage {
  const title = (candidate.title || "Historical image").replace(/\s+/g, " ").trim();
  const creator = (candidate.creator || "").trim();
  const license = (candidate.license || "unknown").trim();
  const sourceParts = [candidate.source];
  if (license && license !== "unknown") sourceParts.push(`(${license})`);
  if (creator) sourceParts.push(`• ${creator}`);
  return { url: publicUrl, caption: title, source: sourceParts.join(" ") };
}

async function processEvent(
  event: TimelineEvent,
  topicId: string,
  options: PipelineOptions,
  csvIndex: Map<string, CsvImageRow[]>
): Promise<{ success: boolean; count: number }> {
  const adapters = getAdapters(options.sources);

  // Gather candidates from all enabled sources
  const allCandidates: CandidateImage[] = [];
  for (const adapter of adapters) {
    try {
      const candidates = await adapter.fetchCandidates(event, { csvIndex });
      allCandidates.push(...candidates);
      console.log(`    ${adapter.name}: ${candidates.length} candidates`);
    } catch (err: any) {
      console.warn(`    ${adapter.name} failed: ${err?.message || String(err)}`);
    }
  }

  if (allCandidates.length === 0) {
    console.log(`    No candidates found.`);
    return { success: false, count: 0 };
  }

  // Filter, score, deduplicate, rank
  const selected = filterAndRank(allCandidates, options.maxImages);
  console.log(`    ${selected.length} selected after filtering (from ${allCandidates.length} total)`);

  if (options.dryRun) {
    for (const [i, img] of selected.entries()) {
      console.log(`      ${i + 1}. [${img.provider}] ${(img.title || "").slice(0, 80)}`);
    }
    return { success: true, count: selected.length };
  }

  // Download and upload to GCS (sequential to respect rate limits)
  const images: EventImage[] = [];
  for (let i = 0; i < selected.length; i++) {
    const candidate = selected[i];
    console.log(`    Uploading ${i + 1}/${selected.length}: [${candidate.provider}]...`);
    const uploaded = await uploadImageToGcs(candidate, topicId, event.id, i);
    if (uploaded) {
      images.push(toEventImage(uploaded.publicUrl, uploaded.candidate));
    } else {
      console.warn(`      Failed to download/upload: ${candidate.url.slice(0, 80)}`);
    }
    await sleep(300);
  }

  if (images.length === 0) {
    console.log(`    All uploads failed.`);
    return { success: false, count: 0 };
  }

  // Save to Firestore
  const saved = await saveImages(topicId, event.id, images);
  if (saved) {
    console.log(`    Saved ${images.length} images to Firestore.`);
  }
  return { success: saved, count: images.length };
}

export async function runPipeline(options: PipelineOptions): Promise<void> {
  console.log("\n  Image Pipeline");
  console.log("  ==============");
  console.log(`  Topic: ${options.topicId}`);
  console.log(`  Sources: ${[...options.sources].join(", ")}`);
  console.log(`  Max images: ${options.maxImages}`);
  console.log(`  Mode: ${options.dryRun ? "dry-run" : "write"}${options.force ? ", force" : ""}`);
  if (options.csvPath) console.log(`  CSV: ${options.csvPath}`);
  console.log();

  // Fetch all events
  const events = await fetchEvents(options.topicId);
  if (events.length === 0) {
    console.log("  No events found.");
    return;
  }

  const selectedEvents = options.eventFilter
    ? events.filter((e) => e.id === options.eventFilter)
    : events;

  if (selectedEvents.length === 0) {
    console.log(`  No event matched: ${options.eventFilter}`);
    return;
  }

  console.log(`  Processing ${selectedEvents.length} events...\n`);

  // Build CSV index if needed
  let csvIndex = new Map<string, CsvImageRow[]>();
  if (options.csvPath && (options.sources.has("nara-csv") || options.sources.has("all"))) {
    console.log(`  Building CSV index from: ${options.csvPath}`);
    csvIndex = await buildCsvIndex(options.csvPath, selectedEvents);
    console.log();
  }

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const event of selectedEvents) {
    console.log(`  [${event.id}] ${event.title}`);

    // Skip if already has GCS images (unless --force)
    if (!options.force && eventHasGcsImages(event)) {
      console.log(`    Already has GCS images, skipping. (--force to overwrite)`);
      skipped++;
      continue;
    }

    const result = await processEvent(event, options.topicId, options, csvIndex);
    if (result.success) success++;
    else failed++;

    console.log();
  }

  console.log("  ==============");
  console.log(`  Done: ${success} succeeded, ${skipped} skipped, ${failed} failed\n`);
}
