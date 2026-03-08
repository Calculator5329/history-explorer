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
  generatedBy: "preseed" | "chat" | "enrichment";
  enriched: boolean;
  wikipediaSearchQuery?: string;
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  branches: Branch[];
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
