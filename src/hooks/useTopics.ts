import { useEffect, useState, useCallback } from "react";
import type { Topic } from "../types/index.ts";
import { listTopics } from "../services/timeline-builder.ts";
import { sampleTopic } from "../data/ww2-sample.ts";

export function useTopics() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await listTopics();
      if (loaded.length === 0) {
        setTopics([sampleTopic]);
      } else {
        setTopics(loaded);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list topics");
      setTopics([sampleTopic]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { topics, loading, error, refresh };
}
