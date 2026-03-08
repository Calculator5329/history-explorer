import { proxy } from "./config.ts";
import type { EventImage, TimelineEvent } from "../../types/index.ts";
import { isGcsUrl } from "./storage.ts";

export async function fetchEvents(topicId: string): Promise<TimelineEvent[]> {
  try {
    const result = await (proxy.firestore as any).list(
      `topics/${topicId}/events`,
      { limit: 500, orderBy: "date", direction: "asc" }
    );
    return Array.isArray(result?.documents) ? result.documents : [];
  } catch {
    return [];
  }
}

export async function saveImages(topicId: string, eventId: string, images: EventImage[]): Promise<boolean> {
  try {
    await proxy.firestore.patch(`topics/${topicId}/events/${eventId}`, { images });
    return true;
  } catch (err: any) {
    console.warn(`    Firestore save failed for ${eventId}: ${err?.message || String(err)}`);
    return false;
  }
}

export function eventHasGcsImages(event: TimelineEvent): boolean {
  if (!event.images || event.images.length === 0) return false;
  return event.images.some((img) => isGcsUrl(img.url));
}
