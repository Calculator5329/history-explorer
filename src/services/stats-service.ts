import { fetchCollection } from "./firestore-cache.ts";
import type { TimelineEvent, Topic } from "../types/index.ts";
import type { GeneratedByBreakdown, GlobalStats, StatsResponse, TopicStats } from "../types/index.ts";

const GENERATED_BY_KEYS: Array<keyof GeneratedByBreakdown> = [
  "preseed",
  "chat",
  "enrichment",
  "expansion",
  "seed",
];

function emptyBreakdown(): GeneratedByBreakdown {
  return {
    preseed: 0,
    chat: 0,
    enrichment: 0,
    expansion: 0,
    seed: 0,
  };
}

function normalizeTopics(raw: any[]): Topic[] {
  return raw
    .filter((doc) => doc && typeof doc.name === "string")
    .map((doc) => ({
      id: doc.id,
      name: doc.name,
      description: doc.description || "",
      createdAt: doc.createdAt || new Date().toISOString(),
      branches: Array.isArray(doc.branches) ? doc.branches : [],
      eventIds: Array.isArray(doc.eventIds) ? doc.eventIds : undefined,
      timeframe: doc.timeframe,
      seededAt: doc.seededAt,
      seedPrompt: doc.seedPrompt,
    }));
}

function computeTopicStats(topic: Topic, events: TimelineEvent[]): TopicStats {
  const generatedBy = emptyBreakdown();
  let sourceCount = 0;
  let eventsWithContent = 0;
  let eventsWithImages = 0;

  for (const event of events) {
    sourceCount += Array.isArray(event.sources) ? event.sources.length : 0;
    if (event.content && event.content.trim()) eventsWithContent += 1;
    if (Array.isArray(event.images) && event.images.length > 0) {
      eventsWithImages += 1;
    }

    const key = event.generatedBy as keyof GeneratedByBreakdown;
    if (GENERATED_BY_KEYS.includes(key)) {
      generatedBy[key] += 1;
    }
  }

  return {
    topicId: topic.id,
    topicName: topic.name,
    branchCount: topic.branches.length,
    eventCount: events.length,
    sourceCount,
    eventsWithContent,
    eventsWithImages,
    generatedBy,
  };
}

function aggregateGlobal(topicStats: TopicStats[]): GlobalStats {
  const generatedBy = emptyBreakdown();
  let eventCount = 0;
  let branchCount = 0;
  let sourceCount = 0;
  let eventsWithContent = 0;
  let eventsWithImages = 0;

  for (const topic of topicStats) {
    eventCount += topic.eventCount;
    branchCount += topic.branchCount;
    sourceCount += topic.sourceCount;
    eventsWithContent += topic.eventsWithContent;
    eventsWithImages += topic.eventsWithImages;
    for (const key of GENERATED_BY_KEYS) {
      generatedBy[key] += topic.generatedBy[key];
    }
  }

  return {
    topicCount: topicStats.length,
    eventCount,
    branchCount,
    sourceCount,
    eventsWithContent,
    eventsWithImages,
    generatedBy,
  };
}

export async function getSiteStats(): Promise<StatsResponse> {
  const warnings: string[] = [];
  const topicsRaw = await fetchCollection("topics", { limit: 200 });
  const topics = normalizeTopics(topicsRaw);

  const topicStats: TopicStats[] = [];

  for (const topic of topics) {
    try {
      const eventDocs = await fetchCollection(`topics/${topic.id}/events`, {
        limit: 1000,
        orderBy: "date",
        direction: "asc",
      });
      const events = eventDocs as TimelineEvent[];
      topicStats.push(computeTopicStats(topic, events));
    } catch (err) {
      warnings.push(`Failed to load events for ${topic.name}`);
      console.warn("Stats topic load failed:", topic.id, err);
    }
  }

  const global = aggregateGlobal(topicStats);
  return {
    generatedAt: new Date().toISOString(),
    global,
    topics: topicStats,
    warnings,
  };
}
