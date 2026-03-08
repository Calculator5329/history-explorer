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

async function downloadImage(url: string): Promise<{ blob: Blob; contentType: string } | null> {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; history-explorer/1.0)" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) return null;
    const contentType = resp.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const blob = await resp.blob();
    if (blob.size < 5_000) return null;      // Too small / broken
    if (blob.size > 10_000_000) return null;  // Over 10MB proxy limit
    return { blob, contentType };
  } catch {
    return null;
  }
}

export async function uploadImageToGcs(
  candidate: CandidateImage,
  topicId: string,
  eventId: string,
  index: number
): Promise<UploadedImage | null> {
  const downloaded = await downloadImage(candidate.url);
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
