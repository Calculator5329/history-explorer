import { proxy } from "../proxy.ts";
import { enrichEvent, generateEventContent } from "./event-enricher.ts";
import type {
  Branch,
  BranchDraft,
  EventType,
  ProposedEvent,
  Region,
  TimelineEvent,
  Topic,
  TopicDraft,
} from "../types/index.ts";

const VALID_IMPORTANCE = new Set(["critical", "major", "standard", "minor"] as const);
const VALID_EVENT_TYPES = new Set([
  "battle",
  "bombing",
  "invasion",
  "naval",
  "treaty",
  "declaration",
  "surrender",
  "homefront",
  "political",
  "liberation",
  "evacuation",
] as const);
const VALID_REGIONS = new Set([
  "western_europe",
  "eastern_europe",
  "pacific",
  "north_africa",
  "north_america",
  "east_asia",
  "southeast_asia",
  "atlantic",
] as const);

const BRANCH_COLORS = ["#4A90D9", "#E74C3C", "#2ECC71", "#F39C12", "#9B59B6", "#16A085"];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "topic";
}

function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();
}

function parseJsonObject(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return JSON.parse(fenced[1].trim());
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(text.slice(start, end + 1));
  }

  throw new Error("No JSON object in AI response");
}

function sanitizeDate(value: string): string {
  const trimmed = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  if (/^\d{4}$/.test(trimmed)) return `${trimmed}-01-01`;
  return "1900-01-01";
}

function sanitizeBranchId(value: string): string {
  const id = slugify(value).slice(0, 24);
  return id || "general";
}

function sanitizeProposedEvent(raw: any, branches: Branch[]): ProposedEvent | null {
  const title = String(raw?.title || "").trim();
  const summary = String(raw?.summary || "").trim();
  if (!title || !summary) return null;

  const branchIds = new Set(branches.map((b) => b.id));
  const branch = branchIds.has(raw?.branch) ? raw.branch : branches[0]?.id || "general";
  const importance = VALID_IMPORTANCE.has(raw?.importance)
    ? raw.importance
    : "standard";
  const eventType = VALID_EVENT_TYPES.has(raw?.eventType)
    ? (raw.eventType as EventType)
    : undefined;
  const region = VALID_REGIONS.has(raw?.region)
    ? (raw.region as Region)
    : undefined;

  return {
    title,
    date: sanitizeDate(raw?.date),
    endDate: raw?.endDate ? sanitizeDate(raw.endDate) : undefined,
    branch,
    importance,
    summary,
    wikipediaSearchQuery: String(raw?.wikipediaSearchQuery || title),
    eventType,
    region,
  };
}

function isNearDuplicate(proposed: ProposedEvent, existing: TimelineEvent[]): boolean {
  const pTitle = normalizeTitle(proposed.title);
  const pYear = proposed.date.slice(0, 4);

  return existing.some((ev) => {
    const eTitle = normalizeTitle(ev.title);
    if (!eTitle || !pTitle) return false;
    if (eTitle === pTitle) return true;
    if ((eTitle.includes(pTitle) || pTitle.includes(eTitle)) && ev.date.slice(0, 4) === pYear) {
      return true;
    }
    return false;
  });
}

function dedupeProposals(events: ProposedEvent[], existing: TimelineEvent[]): ProposedEvent[] {
  const accepted: ProposedEvent[] = [];
  for (const event of events) {
    if (isNearDuplicate(event, [...existing, ...accepted.map((e) => ({
      id: "preview",
      title: e.title,
      date: e.date,
      branch: e.branch,
      importance: e.importance,
      summary: e.summary,
      sources: [],
      connections: [],
      generatedBy: "expansion",
      enriched: false,
      eventType: e.eventType,
      region: e.region,
    })) as TimelineEvent[]])) {
      continue;
    }
    accepted.push(event);
  }
  return accepted;
}

function topicContext(topic: Topic, events: TimelineEvent[]): string {
  const lines = events
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 250)
    .map((e) => `- ${e.date} | ${e.title} | ${e.branch} | ${e.importance}`)
    .join("\n");

  return `Topic: ${topic.name}\nDescription: ${topic.description}\nBranches:\n${topic.branches
    .map((b) => `- ${b.id}: ${b.name}`)
    .join("\n")}\n\nExisting events:\n${lines}`;
}

async function runJsonPrompt(system: string, user: string, maxTokens = 2000): Promise<any> {
  const response: any = await (proxy.ai as any).chat({
    provider: "openai",
    model: "gpt-4o",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxTokens,
  });

  return parseJsonObject(response.content || "{}");
}

export async function listTopics(): Promise<Topic[]> {
  const raw: any = await (proxy.firestore as any).list("topics", { limit: 100 });
  const documents = Array.isArray(raw) ? raw : raw?.documents;
  if (!Array.isArray(documents)) return [];

  return documents
    .filter((doc) => doc && typeof doc.name === "string")
    .map((doc) => ({
      ...doc,
      id: doc.id || slugify(doc.name),
      branches: Array.isArray(doc.branches) ? doc.branches : [],
      description: doc.description || "",
      createdAt: doc.createdAt || new Date().toISOString(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function expandTimeline(
  topic: Topic,
  events: TimelineEvent[],
  targetCount = 10
): Promise<ProposedEvent[]> {
  const system = `You are a historian expanding timeline coverage. Return JSON only.\nOutput format:\n{"events":[{"title":"...","date":"YYYY-MM-DD","endDate":"YYYY-MM-DD(optional)","branch":"branch_id","importance":"critical|major|standard|minor","summary":"1-2 sentences","eventType":"battle|bombing|invasion|naval|treaty|declaration|surrender|homefront|political|liberation|evacuation","region":"western_europe|eastern_europe|pacific|north_africa|north_america|east_asia|southeast_asia|atlantic","wikipediaSearchQuery":"..."}]}\nRules: include lesser-known events, avoid duplicates, stay historically accurate.`;

  const user = `${topicContext(topic, events)}\n\nAdd exactly ${targetCount} NEW events to expand coverage. Include at least 4 less-known events.`;

  const parsed = await runJsonPrompt(system, user, 2200);
  const candidateRaw = Array.isArray(parsed?.events) ? parsed.events : [];

  const sanitized = candidateRaw
    .map((raw: any) => sanitizeProposedEvent(raw, topic.branches))
    .filter((ev: ProposedEvent | null): ev is ProposedEvent => Boolean(ev));

  return dedupeProposals(sanitized, events).slice(0, targetCount);
}

export async function generateTopicBranches(draft: TopicDraft): Promise<BranchDraft[]> {
  const system = `You generate timeline branches. Return JSON only in this shape: {"branches":[{"id":"stable_id","name":"Human Name","color":"#RRGGBB"}]}. Exactly 4 branches.`;
  const user = `Topic name: ${draft.name}\nDescription: ${draft.description}\nTimeframe: ${draft.timeframe}\nGenerate 4 broad but useful branches.`;

  const parsed = await runJsonPrompt(system, user, 1000);
  const raw = Array.isArray(parsed?.branches) ? parsed.branches : [];

  const sanitized = raw.slice(0, 4).map((branch: any, idx: number) => ({
    id: sanitizeBranchId(String(branch?.id || branch?.name || `lane_${idx + 1}`)),
    name: String(branch?.name || `Branch ${idx + 1}`).slice(0, 50),
    color: /^#[0-9A-Fa-f]{6}$/.test(String(branch?.color || ""))
      ? String(branch.color)
      : BRANCH_COLORS[idx % BRANCH_COLORS.length],
  }));

  while (sanitized.length < 4) {
    const idx = sanitized.length;
    sanitized.push({
      id: `lane_${idx + 1}`,
      name: `Branch ${idx + 1}`,
      color: BRANCH_COLORS[idx % BRANCH_COLORS.length],
    });
  }

  return sanitized.slice(0, 4);
}

export async function generateSeedEvents(
  draft: TopicDraft,
  branches: BranchDraft[],
  targetCount = 10
): Promise<ProposedEvent[]> {
  const branchLines = branches.map((b) => `- ${b.id}: ${b.name}`).join("\n");
  const system = `You create initial historical timeline events. Return JSON only with this shape: {"events":[...]} where each event has title,date,branch,importance,summary,eventType,region,wikipediaSearchQuery and optional endDate.`;
  const user = `Topic: ${draft.name}\nDescription: ${draft.description}\nTimeframe: ${draft.timeframe}\nBranches:\n${branchLines}\n\nGenerate exactly ${targetCount} seed events covering the scope. Include a mix of major and less-known events.`;

  const parsed = await runJsonPrompt(system, user, 2200);
  const rawEvents = Array.isArray(parsed?.events) ? parsed.events : [];
  const typedBranches: Branch[] = branches.map((b) => ({ ...b }));
  const sanitized = rawEvents
    .map((raw: any) => sanitizeProposedEvent(raw, typedBranches))
    .filter((ev: ProposedEvent | null): ev is ProposedEvent => Boolean(ev));

  return sanitized.slice(0, targetCount);
}

export async function persistProposedEvents(
  topicId: string,
  proposed: ProposedEvent[],
  generatedBy: "expansion" | "seed",
  existingEvents: TimelineEvent[]
): Promise<TimelineEvent[]> {
  const createdEvents: TimelineEvent[] = [];

  const sortedExisting = [...existingEvents].sort((a, b) => a.date.localeCompare(b.date));

  for (const item of proposed) {
    const nearest = sortedExisting.find((ev) => ev.branch === item.branch);
    const payload = {
      title: item.title,
      date: item.date,
      endDate: item.endDate || null,
      branch: item.branch,
      importance: item.importance,
      summary: item.summary,
      eventType: item.eventType,
      region: item.region,
      wikipediaSearchQuery: item.wikipediaSearchQuery || item.title,
      sources: [],
      connections: nearest ? [nearest.id] : [],
      generatedBy,
      enriched: false,
    };

    const created = await (proxy.firestore as any).create(`topics/${topicId}/events`, payload);
    const newEvent: TimelineEvent = {
      ...payload,
      id: created.id,
      endDate: item.endDate,
      connections: payload.connections,
      sources: [],
    } as TimelineEvent;
    createdEvents.push(newEvent);
    sortedExisting.push(newEvent);
  }

  if (createdEvents.length > 0) {
    try {
      const topicDoc: any = await proxy.firestore.get(`topics/${topicId}`);
      const existingIds: string[] = Array.isArray(topicDoc?.eventIds) ? topicDoc.eventIds : [];
      const mergedIds = [...new Set([...existingIds, ...createdEvents.map((e) => e.id)])];
      await proxy.firestore.patch(`topics/${topicId}`, { eventIds: mergedIds });
    } catch {
      await proxy.firestore.patch(`topics/${topicId}`, { eventIds: createdEvents.map((e) => e.id) });
    }
  }

  return createdEvents;
}

export function runDeepenPass(topicId: string, existingEvents: TimelineEvent[], newEvents: TimelineEvent[]): void {
  const keyExisting = existingEvents
    .filter((e) => (e.importance === "critical" || e.importance === "major") && (!e.content || (e.sources?.length || 0) < 2))
    .slice(0, 6);

  const allTargets = [...newEvents, ...keyExisting];

  for (const target of allTargets) {
    void enrichEvent(topicId, target)
      .then((enriched) => {
        const shouldGenerate = !enriched.content || (enriched.sources?.length || 0) < 2 || newEvents.some((n) => n.id === enriched.id);
        if (!shouldGenerate) return;
        return generateEventContent(topicId, enriched, true);
      })
      .catch((err) => {
        console.warn("Deepen pass failed:", err);
      });
  }
}

export async function createTopicFromDraft(
  draft: TopicDraft,
  branches: BranchDraft[],
  seedEvents: ProposedEvent[]
): Promise<{ topicId: string }> {
  const createdAt = new Date().toISOString();
  const topicPayload = {
    name: draft.name,
    description: draft.description,
    createdAt,
    branches,
    timeframe: draft.timeframe,
    seededAt: createdAt,
    seedPrompt: `${draft.name} | ${draft.timeframe}`,
    eventIds: [],
  };

  const createdTopic = await (proxy.firestore as any).create("topics", topicPayload);
  const topicId = createdTopic.id;

  await proxy.firestore.patch(`topics/${topicId}`, { id: topicId });

  const createdEvents = await persistProposedEvents(topicId, seedEvents, "seed", []);
  runDeepenPass(topicId, [], createdEvents);

  return { topicId };
}


