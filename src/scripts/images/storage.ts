import { proxy, BUCKET } from "./config.ts";
import type { CandidateImage, UploadedImage } from "./types.ts";

function getExtension(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg", "image/png": ".png",
    "image/webp": ".webp", "image/gif": ".gif",
  };
  return map[contentType] || ".jpg";
}

function buildGcsPath(topicId: string, eventId: string, provider: string, index: number, ext: string): string {
  return `topics/${topicId}/events/${eventId}/${provider}-${index}${ext}`;
}

function getHeaders(url: string): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  if (url.includes("wikimedia.org") || url.includes("wikipedia.org")) {
    headers["Referer"] = "https://commons.wikimedia.org/";
  }
  if (url.includes("loc.gov")) {
    headers["Referer"] = "https://www.loc.gov/";
  }
  return headers;
}

async function downloadImage(url: string, retries = 2): Promise<{ blob: Blob; contentType: string } | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: getHeaders(url),
        signal: AbortSignal.timeout(30_000),
        redirect: "follow",
      });
      if (resp.status === 429 && attempt < retries) {
        const wait = Math.min(5_000, 1_000 * 2 ** attempt);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!resp.ok) return null;
      const contentType = resp.headers.get("content-type") || "image/jpeg";
      if (!contentType.startsWith("image/")) return null;
      const blob = await resp.blob();
      if (blob.size < 5_000) return null;      // Too small / broken
      if (blob.size > 10_000_000) return null;  // Over 10MB proxy limit
      return { blob, contentType };
    } catch {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1_000 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

export async function uploadImageToGcs(
  candidate: CandidateImage,
  topicId: string,
  eventId: string,
  index: number
): Promise<UploadedImage | null> {
  let downloaded = await downloadImage(candidate.url);
  // Fall back to original (non-thumbnail) URL if primary fails
  if (!downloaded && candidate.fallbackUrl) {
    downloaded = await downloadImage(candidate.fallbackUrl);
  }
  if (!downloaded) return null;

  const ext = getExtension(downloaded.contentType);
  const gcsPath = buildGcsPath(topicId, eventId, candidate.provider.toLowerCase(), index, ext);

  try {
    const result = await (proxy.storage as any).upload(BUCKET, downloaded.blob, {
      path: gcsPath,
      public: true,
    });

    const publicUrl = result.publicUrl ||
      `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(gcsPath)}?alt=media`;

    return { gcsPath, publicUrl, candidate };
  } catch (err: any) {
    console.warn(`    GCS upload failed for ${gcsPath}: ${err?.message || String(err)}`);
    return null;
  }
}

export function isGcsUrl(url: string): boolean {
  return url.includes("firebasestorage.googleapis.com") || url.includes(BUCKET) || url.includes("storage.googleapis.com");
}
