import { useState, useEffect } from "react";
import { proxy } from "../proxy.ts";
import type { Topic, TimelineEvent } from "../types/index.ts";

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
        const topicDoc = await proxy.firestore.get<Topic>(`topics/${topicId}`);
        if (cancelled) return;
        setTopic({ ...topicDoc, id: topicId } as Topic);

        const eventDocs = await proxy.firestore.list(`topics/${topicId}/events`, {
          limit: 500,
        });
        if (cancelled) return;
        setEvents(
          eventDocs.documents.map((doc: { id: string } & Record<string, unknown>) => ({
            ...doc,
            id: doc.id,
          })) as TimelineEvent[]
        );
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

  return { topic, events, loading, error, refetch: () => setLoading(true) };
}
