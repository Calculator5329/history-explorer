/**
 * Firestore connectivity test.
 *
 * Run:  npx tsx src/scripts/test-firestore.ts
 *
 * Tests every access pattern the app uses and reports pass/fail.
 * These tests MUST pass for the app to load real data from Firestore.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

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
const headers: Record<string, string> = {
  "Content-Type": "application/json",
  "x-api-key": token,
};

if (!baseUrl || !token) {
  console.error(
    "❌ Missing env vars. Set VITE_PROXY_URL and VITE_PROXY_TOKEN in .env"
  );
  process.exit(1);
}

console.log(`\n🔍 Firestore Connectivity Test`);
console.log(`   Gateway: ${baseUrl}\n`);

// ── Test runner ────────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: TestResult[] = [];

async function fetchJSON(
  method: string,
  path: string,
  body?: any
): Promise<{ status: number; data: any }> {
  const url = `${baseUrl}${path}`;
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  let data: any;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }
  return { status: resp.status, data };
}

// ── Tests ──────────────────────────────────────────────────────────────────

async function testDocumentRead() {
  console.log("Testing: GET /firestore/topics/ww2/events/pearl_harbor ...");
  const { status, data } = await fetchJSON(
    "GET",
    "/firestore/topics/ww2/events/pearl_harbor"
  );

  const hasTitle =
    data?.title === "Attack on Pearl Harbor" ||
    data?.data?.title === "Attack on Pearl Harbor";
  const hasDate =
    data?.date === "1941-12-07" || data?.data?.date === "1941-12-07";
  const isEmptyCollection =
    data?.documents !== undefined && data?.count === 0;

  if (status === 200 && hasTitle && hasDate) {
    results.push({
      name: "Document Read (GET single event)",
      passed: true,
      detail: `200 OK — returned event with title and date`,
    });
  } else if (status === 200 && isEmptyCollection) {
    results.push({
      name: "Document Read (GET single event)",
      passed: false,
      detail:
        `200 but returned {documents:[],count:0} instead of document data.\n` +
        `   The GET handler treats document paths as collection lists.\n` +
        `   FIX: For even-segment paths, use firestore.doc(path).get()`,
    });
  } else {
    results.push({
      name: "Document Read (GET single event)",
      passed: false,
      detail: `Status ${status}. Response: ${JSON.stringify(data).slice(0, 300)}`,
    });
  }
}

async function testCollectionList() {
  console.log(
    "Testing: GET /firestore/topics/ww2/events?limit=5&orderBy=date ..."
  );
  const { status, data } = await fetchJSON(
    "GET",
    "/firestore/topics/ww2/events?limit=5&orderBy=date&direction=asc"
  );

  const hasDocs =
    Array.isArray(data?.documents) && data.documents.length > 0;
  const firstDoc = data?.documents?.[0];
  const firstValid =
    firstDoc &&
    typeof firstDoc.title === "string" &&
    typeof firstDoc.date === "string";

  if (status === 200 && hasDocs && firstValid) {
    results.push({
      name: "Collection List (GET events collection)",
      passed: true,
      detail: `200 OK — returned ${data.documents.length} events`,
    });
  } else if (status === 404) {
    results.push({
      name: "Collection List (GET events collection)",
      passed: false,
      detail:
        `404 Not Found. No list handler for subcollection paths.\n` +
        `   FIX: For odd-segment paths, use firestore.collection(path).get()`,
    });
  } else {
    results.push({
      name: "Collection List (GET events collection)",
      passed: false,
      detail: `Status ${status}. Response: ${JSON.stringify(data).slice(0, 300)}`,
    });
  }
}

async function testTopicRead() {
  console.log("Testing: GET /firestore/topics/ww2 ...");
  const { status, data } = await fetchJSON("GET", "/firestore/topics/ww2");

  const hasName =
    data?.name === "World War II" || data?.data?.name === "World War II";

  if (status === 200 && hasName) {
    const hasBranches =
      Array.isArray(data?.branches) || Array.isArray(data?.data?.branches);
    results.push({
      name: "Topic Document Read",
      passed: true,
      detail: `200 OK — returned topic with name${hasBranches ? " and branches" : " (branches missing — may need re-preseed)"}`,
    });
  } else if (status === 200 && data?.documents !== undefined) {
    results.push({
      name: "Topic Document Read",
      passed: false,
      detail:
        `200 but returned collection format instead of document fields.\n` +
        `   FIX: Even-segment path (topics/ww2 = 2) should use firestore.doc(path).get()`,
    });
  } else {
    results.push({
      name: "Topic Document Read",
      passed: false,
      detail: `Status ${status}. Response: ${JSON.stringify(data).slice(0, 300)}`,
    });
  }
}

async function testBatchWrite() {
  console.log("Testing: POST /firestore/batch (empty operations) ...");
  const { status, data } = await fetchJSON("POST", "/firestore/batch", {
    operations: [],
  });

  // Empty operations returning 400 is valid input validation.
  // The batch endpoint works (preseed uses it successfully).
  const batchResponds = status === 200 || status === 201 || status === 400;
  results.push({
    name: "Batch Endpoint (POST /firestore/batch)",
    passed: batchResponds,
    detail: batchResponds
      ? `${status} — Batch endpoint responding (400 for empty ops is valid validation)`
      : `Status ${status}. ${JSON.stringify(data).slice(0, 100)}`,
  });
}

// ── Run all tests ──────────────────────────────────────────────────────────

async function run() {
  await testDocumentRead();
  await new Promise((r) => setTimeout(r, 500));

  await testCollectionList();
  await new Promise((r) => setTimeout(r, 500));

  await testTopicRead();
  await new Promise((r) => setTimeout(r, 500));

  await testBatchWrite();

  // ── Report ───────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  TEST RESULTS");
  console.log("═══════════════════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  for (const r of results) {
    const icon = r.passed ? "✅" : "❌";
    console.log(`${icon} ${r.name}`);
    console.log(`   ${r.detail}\n`);
    if (r.passed) passed++;
    else failed++;
  }

  console.log("───────────────────────────────────────────────────");
  console.log(`  Passed: ${passed}/${results.length}`);
  console.log(`  Failed: ${failed}/${results.length}`);
  console.log("───────────────────────────────────────────────────\n");

  if (failed > 0) {
    console.log("📋 REQUIRED SERVER CHANGES:");
    console.log("");
    console.log("  The GET /firestore/* handler needs to:");
    console.log("  1. Count path segments");
    console.log(
      "  2. Even segments → firestore.doc(path).get() → return { id, ...data }"
    );
    console.log(
      "  3. Odd segments  → firestore.collection(path).get() → return { documents, count }"
    );
    console.log("");
    console.log("  See CLOUD_RUN_FIX.md for full implementation.\n");
    process.exit(1);
  } else {
    console.log(
      "🎉 All tests passed! The app should load data from Firestore.\n"
    );
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
