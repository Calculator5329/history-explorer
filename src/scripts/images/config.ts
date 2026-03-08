import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@calculator-5329/cloud-proxy";

// Load .env
try {
  const envPath = resolve(import.meta.dirname, "../../../.env");
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

const proxyUrl = (process.env.PROXY_URL || process.env.VITE_PROXY_URL || "").trim();
const proxyToken = (process.env.PROXY_TOKEN || process.env.VITE_PROXY_TOKEN || "").trim();

if (!proxyUrl || !proxyToken) {
  console.error("Missing env vars. Set VITE_PROXY_URL and VITE_PROXY_TOKEN in .env");
  process.exit(1);
}

export const proxy = createClient({ baseUrl: proxyUrl, token: proxyToken });

export const BUCKET = "ethan-488900.firebasestorage.app";
export const RATE_LIMIT_MS = 800;
export const MAX_IMAGES_PER_EVENT = 10;
export const TARGET_IMAGES = 8;

