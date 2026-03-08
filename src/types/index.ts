export interface Branch {
  id: string;
  name: string;
  color: string;
}

export interface Source {
  title: string;
  url: string;
  snippet: string;
}

export type EventType =
  | "battle"
  | "bombing"
  | "invasion"
  | "naval"
  | "treaty"
  | "declaration"
  | "surrender"
  | "homefront"
  | "political"
  | "liberation"
  | "evacuation";

export type Region =
  | "western_europe"
  | "eastern_europe"
  | "pacific"
  | "north_africa"
  | "north_america"
  | "east_asia"
  | "southeast_asia"
  | "atlantic";

export interface EventImage {
  url: string;
  caption: string;
  source?: string;
}

export interface TimelineEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  branch: string;
  importance: "critical" | "major" | "standard" | "minor";
  summary: string;
  content?: string;
  wikipediaImageUrl?: string;
  wikipediaExtract?: string;
  sources: Source[];
  connections: string[];
  generatedBy: "preseed" | "chat" | "enrichment" | "expansion" | "seed";
  enriched: boolean;
  wikipediaSearchQuery?: string;
  eventType?: EventType;
  region?: Region;
  images?: EventImage[];
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  branches: Branch[];
  eventIds?: string[];
  seededAt?: string;
  seedPrompt?: string;
  timeframe?: string;
}

export interface ProposedEvent {
  title: string;
  date: string;
  endDate?: string;
  branch: string;
  importance: "critical" | "major" | "standard" | "minor";
  summary: string;
  wikipediaSearchQuery?: string;
  eventType?: EventType;
  region?: Region;
}

export interface TopicDraft {
  name: string;
  description: string;
  timeframe: string;
}

export interface BranchDraft {
  id: string;
  name: string;
  color: string;
}


export interface GeneratedByBreakdown {
  preseed: number;
  chat: number;
  enrichment: number;
  expansion: number;
  seed: number;
}

export interface TopicStats {
  topicId: string;
  topicName: string;
  branchCount: number;
  eventCount: number;
  sourceCount: number;
  eventsWithContent: number;
  eventsWithImages: number;
  generatedBy: GeneratedByBreakdown;
}

export interface GlobalStats {
  topicCount: number;
  eventCount: number;
  branchCount: number;
  sourceCount: number;
  eventsWithContent: number;
  eventsWithImages: number;
  generatedBy: GeneratedByBreakdown;
}

export interface StatsResponse {
  generatedAt: string;
  global: GlobalStats;
  topics: TopicStats[];
  warnings: string[];
}
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  addedEvents?: string[];
}

export interface Chat {
  id: string;
  messages: ChatMessage[];
  createdAt: string;
}

