import { useState, useEffect } from "react";
import type { TimelineEvent } from "../types/index.ts";
import { fetchDoc, isValidEvent } from "../services/firestore-cache.ts";

export function useEvent(
  topicId: string | undefined,
  eventId: string | undefined
) {
  const [event, setEvent] = useState<TimelineEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!topicId || !eventId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const doc = await fetchDoc(`topics/${topicId}/events/${eventId}`);

        if (!cancelled) {
          if (doc && isValidEvent(doc)) {
            setEvent({ ...doc, id: doc.id || eventId } as TimelineEvent);
          } else {
            // Server returned empty/invalid response — let page fall back to sample
            setEvent(null);
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load event"
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [topicId, eventId]);

  return { event, loading, error, setEvent };
}
