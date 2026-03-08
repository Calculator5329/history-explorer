import { createClient } from "@calculator-5329/cloud-proxy";
import { readFileSync } from "fs";
import { resolve } from "path";

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

const proxy = createClient({
  baseUrl: (process.env.PROXY_URL || process.env.VITE_PROXY_URL)!,
  token: (process.env.PROXY_TOKEN || process.env.VITE_PROXY_TOKEN)!,
});

// Test: Get topics/ww2
console.log("Test 1: Get topics/ww2...");
try {
  const result = await (proxy.firestore as any).get("topics/ww2");
  console.log("Success:", JSON.stringify(result));
} catch (err: any) {
  console.error("Failed:", err.message);
}

// Test: Create in subcollection via SDK
console.log("\nTest 2: Create doc in topics/ww2/events via SDK...");
try {
  const result = await (proxy.firestore as any).create("topics/ww2/events", { title: "test" });
  console.log("Success:", JSON.stringify(result));
  // Clean up
  await (proxy.firestore as any).delete(`topics/ww2/events/${result.id}`);
  console.log("Cleaned up.");
} catch (err: any) {
  console.error("Failed:", err.message, JSON.stringify(err.details || {}));
}

// Test: Raw fetch to bypass SDK
const base = (process.env.PROXY_URL || process.env.VITE_PROXY_URL)!;
const apiKey = (process.env.PROXY_TOKEN || process.env.VITE_PROXY_TOKEN)!;

console.log("\nTest 3: Raw POST /firestore/topics/ww2/events...");
try {
  const resp = await fetch(`${base}/firestore/topics/ww2/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ data: { title: "raw test" } }),
  });
  console.log(`Status: ${resp.status}, Body: ${await resp.text()}`);
} catch (err: any) {
  console.error("Failed:", err.message);
}
