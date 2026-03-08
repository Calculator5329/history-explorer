import { useState, useEffect } from "react";
import type { Topic, TimelineEvent } from "../types/index.ts";

const baseUrl = import.meta.env.VITE_PROXY_URL;
const token = import.meta.env.VITE_PROXY_TOKEN;
const headers = { "Content-Type": "application/json", "x-api-key": token };

export function useTimeline(topicId: string | undefined) {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!topicId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Use query endpoint to list events (bypasses path resolution bug)
        const resp = await fetch(`${baseUrl}/firestore/topics/${topicId}/events/query`, {
          method: "POST", headers,
          body: JSON.stringify({
            orderBy: [{ field: "date", direction: "asc" }],
            limit: 500,
          }),
        });

        if (!resp.ok) {
          // Fallback: try the regular list endpoint
          const listResp = await fetch(`${baseUrl}/firestore/topics/${topicId}/events?limit=500`, {
            method: "GET", headers,
          });
          if (listResp.ok) {
            const listData = await listResp.json();
            if (!cancelled) {
              setEvents((listData.documents || []) as TimelineEvent[]);
            }
          } else {
            throw new Error(`Failed to load events: ${resp.status}`);
          }
        } else {
          const data = await resp.json();
          if (!cancelled) {
            setEvents((data.documents || []) as TimelineEvent[]);
          }
        }

        // Try to get topic doc for branches
        // The server has a path bug, so try batch-style read
        // For now, we'll set a null topic and let the fallback handle branches
        if (!cancelled) {
          setTopic(null); // Will fall back to sampleTopic in TimelinePage
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load timeline");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [topicId]);

  return { topic, events, loading, error };
}
