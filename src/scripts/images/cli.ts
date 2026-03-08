import { existsSync } from "fs";
import type { PipelineOptions } from "./types.ts";
import { parseArg, parseFlag } from "./utils.ts";
import { runPipeline } from "./pipeline.ts";
import { runMigration } from "./migration.ts";

function parseSources(value?: string): Set<string> {
  if (!value) return new Set(["all"]);
  const parsed = new Set(
    value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  );
  return parsed.size > 0 ? parsed : new Set(["all"]);
}

const options: PipelineOptions = {
  topicId: parseArg("topic") || "ww2",
  eventFilter: parseArg("event"),
  sources: parseSources(parseArg("source")),
  maxImages: Math.max(1, Number(parseArg("max") || 8)),
  dryRun: parseFlag("dry-run"),
  force: parseFlag("force"),
  csvPath: parseArg("csv"),
  concurrency: Math.max(1, Number(parseArg("concurrency") || 3)),
  migrate: parseFlag("migrate"),
};

// Validate CSV path if provided
if (options.csvPath && !existsSync(options.csvPath)) {
  console.error(`CSV file not found: ${options.csvPath}`);
  process.exit(1);
}

async function main() {
  if (options.migrate) {
    await runMigration(options);
  } else {
    await runPipeline(options);
  }
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
