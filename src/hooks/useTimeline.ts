import { useState, useEffect, useCallback } from "react";
import type { Topic, TimelineEvent } from "../types/index.ts";
import { sampleEvents } from "../data/ww2-sample.ts";
import {
  fetchCollection,
  fetchDoc,
  fetchDocsBatched,
  isValidEvent,
} from "../services/firestore-cache.ts";

export function useTimeline(topicId: string | undefined) {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const refresh = useCallback(() => {
    setReloadTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!topicId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const sampleById = new Map(sampleEvents.map((e) => [e.id, e]));
      const backfillSampleFields = (docs: TimelineEvent[]) =>
        docs.map((doc) => {
          const sample = sampleById.get(doc.id);
          if (sample && !doc.region && sample.region) {
            return { ...doc, region: sample.region };
          }
          return doc;
        });

      try {
        let docs: TimelineEvent[] = [];

        try {
          const raw = await fetchCollection(`topics/${topicId}/events`, {
            limit: 500,
            orderBy: "date",
            direction: "asc",
          });
          const valid = raw.filter(isValidEvent);
          if (valid.length > 0) {
            docs = backfillSampleFields(valid);
          } else {
            throw new Error("Collection list returned no valid events");
          }
        } catch (collectionErr) {
          console.warn("Collection list failed:", collectionErr);

          try {
            const knownIds = sampleEvents.map((e) => e.id);

            try {
              const topicDoc = await fetchDoc(`topics/${topicId}`);
              if (topicDoc?.eventIds && Array.isArray(topicDoc.eventIds)) {
                for (const id of topicDoc.eventIds) {
                  if (!knownIds.includes(id)) knownIds.push(id);
                }
              }
            } catch {
              // Ignore topic read fallback failures
            }

            const paths = knownIds.map((id) => `topics/${topicId}/events/${id}`);
            const results = await fetchDocsBatched(paths, 3, 300);

            for (const [, doc] of results) {
              if (isValidEvent(doc)) {
                docs.push(doc);
              }
            }

            if (docs.length > 0) {
              docs = backfillSampleFields(docs);
              docs.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
            } else {
              throw new Error("No valid events from individual gets");
            }
          } catch (fallbackErr) {
            console.warn("Individual gets also failed:", fallbackErr);
          }
        }

        if (!cancelled) {
          setEvents(docs);
        }

        try {
          const topicDoc = await fetchDoc(`topics/${topicId}`);
          if (!cancelled && topicDoc && topicDoc.name) {
            setTopic(topicDoc as Topic);
          }
        } catch {
          if (!cancelled) setTopic(null);
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
  }, [topicId, reloadTick]);

  return { topic, events, loading, error, refresh };
}
