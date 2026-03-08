import { useState, useEffect } from "react";
import type { TimelineEvent } from "../types/index.ts";

const baseUrl = import.meta.env.VITE_PROXY_URL;
const token = import.meta.env.VITE_PROXY_TOKEN;
const headers: HeadersInit = { "Content-Type": "application/json", "x-api-key": token };

export function useEvent(topicId: string | undefined, eventId: string | undefined) {
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
        // Try direct GET first (4 segments = document path on server)
        const getResp = await fetch(`${baseUrl}/firestore/topics/${topicId}/events/${eventId}`, {
          method: "GET", headers,
        });

        if (getResp.ok) {
          const doc = await getResp.json();
          // Check if it's a document (has title) or a list response (has documents array)
          if (doc.title) {
            if (!cancelled) setEvent({ ...doc, id: eventId } as TimelineEvent);
            return;
          }
        }

        // Fallback: query for the event by document ID
        const queryResp = await fetch(`${baseUrl}/firestore/topics/${topicId}/events/query`, {
          method: "POST", headers,
          body: JSON.stringify({
            filters: [{ field: "__name__", op: "==", value: eventId }],
            limit: 1,
          }),
        });

        if (queryResp.ok) {
          const data = await queryResp.json();
          if (!cancelled && data.documents?.length > 0) {
            setEvent(data.documents[0] as TimelineEvent);
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load event");
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
