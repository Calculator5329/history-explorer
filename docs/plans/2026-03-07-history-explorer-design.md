# History Explorer - Design Document

## Overview

An interactive, AI-powered history explorer. Users explore a horizontal timeline with parallel color-coded lanes (branches), click events to drill into full-page deep dives with rich content, images, and source citations, and chat with an LLM that automatically expands the timeline with new events as you explore.

Starting topic: World War II. Expandable to any historical topic.

## Core Experience

- **Rabbit-hole exploration** — click an event, read about it, ask questions, discover new events
- **Living timeline** — chat responses automatically add new events to the timeline
- **Sources everywhere** — every LLM-generated claim links to real source material
- **Pre-seeded foundation** — topics start with a solid base of 40-60 enriched events

## Architecture

```
React Frontend (Vite + TypeScript)
  ├── Timeline View (D3.js) — horizontal, zoomable, parallel lanes
  ├── Event Page (React) — full-page detail with images, sources, citations
  └── Chat Panel (React) — scoped to current event, spawns new timeline nodes
        │
        ▼
@calculator-5329/cloud-proxy SDK
  ├── proxy.ai.chat() — LLM generation and chat
  ├── proxy.agent.wikipedia() — images
  ├── proxy.agent.search() — source material (Brave Search)
  ├── proxy.agent.enrichEvent() — full enrichment pipeline
  └── proxy.firestore.* — persistence
```

No custom backend. The cloud proxy SDK handles all server-side concerns.

## Data Model

### Firestore Collections

```
/topics/{topicId}
  - name: string
  - description: string
  - createdAt: timestamp
  - branches: [{ id, name, color }]

/topics/{topicId}/events/{eventId}
  - title: string
  - date: string (ISO)
  - endDate: string (optional, for spanning events)
  - branch: string (references branch id)
  - importance: "critical" | "major" | "standard" | "minor"
  - summary: string (1-2 sentences)
  - content: string (full writeup, lazy-loaded)
  - wikipediaImageUrl: string
  - wikipediaExtract: string
  - sources: [{ title, url, snippet }]
  - connections: string[] (related event IDs)
  - generatedBy: "preseed" | "chat" | "enrichment"
  - enriched: boolean

/topics/{topicId}/events/{eventId}/chats/{chatId}
  - messages: [{ role, content, sources?, addedEvents? }]
  - createdAt: timestamp

/search_cache/{queryHash}
  - query: string
  - results: [...]
  - cachedAt: timestamp
```

### Key decisions

- `importance` drives visual weight (node size, icons, zoom-level visibility)
- `connections` enables cross-branch dotted lines
- `content` is lazy — generated on first event page visit
- `generatedBy` distinguishes pre-seeded vs chat-spawned events
- Chat messages track `addedEvents` for traceability

## Timeline View (D3.js)

### Layout

Horizontal timeline with time flowing left to right. Branches are stacked as parallel horizontal lanes, each color-coded. Time axis at top, lane headers fixed on the left.

### Node styling by importance

- **critical** — Large node, star icon, bold label, glow effect
- **major** — Medium node, solid fill
- **standard** — Small node, appears on zoom
- **minor** — Dot, appears on deep zoom

### Behavior

- Zoom/pan via `d3-zoom`. Scroll to zoom, drag to pan.
- Importance filtering: default zoom shows critical + major only. Zoom in to reveal standard/minor.
- Hover shows tooltip with event summary.
- Click navigates to full event page.
- Cross-branch connections shown as dotted curved lines.
- Time axis uses `d3-scale` (scaleTime).

## Event Page

Full-page view with:

- Back button to timeline
- Event title, date, branch indicator
- Wikipedia image
- Rich content with inline citations [1], [2]
- Related events (clickable, navigate to other event pages)
- Sources section with external links
- Chat panel at bottom

### Chat panel behavior

- Scoped to current event via system prompt
- LLM responses can include new events as structured JSON
- New events written to Firestore immediately
- Each new event triggers async enrichment (Wikipedia + search)
- New events appear on timeline when user navigates back

## LLM Pipeline

### Pre-seeding (one-time script per topic)

1. LLM generates skeleton: 40-60 events with title, date, branch, importance, summary, wikipedia_search_query, connections
2. Each event enriched via `proxy.agent.enrichEvent()` (Wikipedia image + Brave Search sources)
3. Critical/major events get full `content` generated with inline citations

### Event enrichment (on drill-down)

1. Fetch sources first (Wikipedia + Brave Search)
2. Pass sources to LLM to write content against real material
3. This prevents hallucinated citations

### Chat prompt

System prompt includes event context. LLM outputs new events as JSON when relevant. Every claim must reference provided sources.

## Tech Stack

- **Frontend:** React 19, Vite 7, TypeScript
- **Visualization:** D3.js
- **Routing:** react-router-dom
- **Backend:** Firebase/Firestore via @calculator-5329/cloud-proxy
- **LLM:** Via proxy SDK (OpenAI/Anthropic/etc.)
- **Images:** Wikipedia API via proxy agent
- **Search:** Brave Search via proxy agent

## Project Structure

```
src/
├── App.tsx
├── main.tsx
├── proxy.ts
├── pages/
│   ├── TimelinePage.tsx
│   └── EventPage.tsx
├── components/
│   ├── Timeline/
│   │   ├── Timeline.tsx
│   │   ├── timeline-renderer.ts
│   │   ├── TimelineTooltip.tsx
│   │   └── LaneHeader.tsx
│   ├── EventDetail/
│   │   ├── EventContent.tsx
│   │   ├── EventSources.tsx
│   │   ├── RelatedEvents.tsx
│   │   └── EventImage.tsx
│   └── Chat/
│       ├── ChatPanel.tsx
│       ├── ChatMessage.tsx
│       └── AddedEventIndicator.tsx
├── hooks/
│   ├── useTimeline.ts
│   ├── useEvent.ts
│   └── useChat.ts
├── services/
│   ├── timeline-generator.ts
│   ├── event-enricher.ts
│   └── chat-service.ts
├── types/
│   └── index.ts
└── scripts/
    └── preseed.ts
```

## Routes

```
/                                → Redirects to /topic/ww2
/topic/:topicId                  → TimelinePage
/topic/:topicId/event/:eventId   → EventPage
```

## Build Phases

1. Types, proxy client, project scaffolding
2. Static timeline renderer with hardcoded sample data
3. Firestore integration, pre-seed script
4. Event page with lazy enrichment
5. Chat panel with event spawning
6. Polish (cross-branch connections, zoom filtering, styling)
