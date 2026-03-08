/**
 * Firestore cache layer with request deduplication and rate-limit protection.
 *
 * Prevents duplicate fetches, caches results for 5 minutes,
 * and throttles concurrent requests to avoid 429 errors.
 */

import { proxy } from "../proxy.ts";
import type { TimelineEvent } from "../types/index.ts";

// ── Cache ──────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expires: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const docCache = new Map<string, CacheEntry<any>>();
const collectionCache = new Map<string, CacheEntry<any[]>>();
const pending = new Map<string, Promise<any>>();

export function clearCache() {
  docCache.clear();
  collectionCache.clear();
}

// ── Single document fetch (with dedup) ─────────────────────────────────────

export async function fetchDoc(path: string): Promise<any | null> {
  // Check cache
  const cached = docCache.get(path);
  if (cached && Date.now() < cached.expires) return cached.value;

  // Deduplicate in-flight requests
  if (pending.has(path)) return pending.get(path)!;

  const promise = proxy.firestore
    .get(path)
    .then((raw: any) => {
      const doc = normalizeDoc(raw, path);
      if (doc) {
        docCache.set(path, { value: doc, expires: Date.now() + CACHE_TTL });
      }
      pending.delete(path);
      return doc;
    })
    .catch((err) => {
      pending.delete(path);
      throw err;
    });

  pending.set(path, promise);
  return promise;
}

// ── Collection list (single request) ───────────────────────────────────────

export async function fetchCollection(
  collectionPath: string,
  options?: { limit?: number; orderBy?: string; direction?: "asc" | "desc" }
): Promise<any[]> {
  const cacheKey = `${collectionPath}|${JSON.stringify(options || {})}`;

  // Check cache
  const cached = collectionCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) return cached.value;

  // Deduplicate
  if (pending.has(cacheKey)) return pending.get(cacheKey)!;

  const promise = proxy.firestore
    .list(collectionPath, options)
    .then((raw: any) => {
      const docs = normalizeCollection(raw);
      collectionCache.set(cacheKey, {
        value: docs,
        expires: Date.now() + CACHE_TTL,
      });
      // Also cache individual documents
      for (const doc of docs) {
        if (doc.id) {
          const docPath = `${collectionPath}/${doc.id}`;
          docCache.set(docPath, {
            value: doc,
            expires: Date.now() + CACHE_TTL,
          });
        }
      }
      pending.delete(cacheKey);
      return docs;
    })
    .catch((err) => {
      pending.delete(cacheKey);
      throw err;
    });

  pending.set(cacheKey, promise);
  return promise;
}

// ── Throttled batch get (fallback for when list doesn't work) ──────────────

export async function fetchDocsBatched(
  paths: string[],
  concurrency = 3,
  delayMs = 300
): Promise<Map<string, any>> {
  const results = new Map<string, any>();

  // Check cache first
  const uncached: string[] = [];
  for (const path of paths) {
    const cached = docCache.get(path);
    if (cached && Date.now() < cached.expires) {
      results.set(path, cached.value);
    } else {
      uncached.push(path);
    }
  }

  if (uncached.length === 0) return results;

  // Fetch in throttled batches
  for (let i = 0; i < uncached.length; i += concurrency) {
    const batch = uncached.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((path) => fetchDoc(path))
    );

    batch.forEach((path, idx) => {
      const result = batchResults[idx];
      if (result.status === "fulfilled" && result.value) {
        results.set(path, result.value);
      }
    });

    // Delay between batches to avoid rate limiting
    if (i + concurrency < uncached.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return results;
}

// ── Response normalisation ─────────────────────────────────────────────────

/**
 * Normalise a single document response.
 *
 * The server may return:
 *   { id, title, date, ... }              ← flat document
 *   { data: { title, date, ... }, id }    ← wrapped in data
 *   { documents: [], count: 0 }           ← empty collection response (bug)
 */
function normalizeDoc(raw: any, path: string): any | null {
  if (!raw) return null;

  // Detect the buggy "empty collection" response from GET
  if (
    raw.documents !== undefined &&
    raw.count !== undefined &&
    Array.isArray(raw.documents) &&
    raw.documents.length === 0
  ) {
    return null; // Server returned empty collection response for document path
  }

  // If wrapped in data, unwrap
  const data = raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)
    ? { ...raw.data, id: raw.id || raw.data.id }
    : raw;

  // Extract ID from path if not present
  if (!data.id) {
    const segments = path.split("/");
    data.id = segments[segments.length - 1];
  }

  return data;
}

/**
 * Normalise a collection list/query response.
 *
 * The server may return:
 *   { documents: [{ id, ... }, ...], count: N }
 *   [{ id, ... }, ...]
 */
function normalizeCollection(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw?.documents && Array.isArray(raw.documents)) return raw.documents;
  return [];
}

// ── Event-specific helpers ─────────────────────────────────────────────────

/**
 * Validate that an object looks like a TimelineEvent.
 */
export function isValidEvent(obj: any): obj is TimelineEvent {
  return obj && typeof obj.title === "string" && typeof obj.date === "string";
}

