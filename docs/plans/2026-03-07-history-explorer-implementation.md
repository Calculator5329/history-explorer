# History Explorer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an interactive, AI-powered WW2 history timeline with branching lanes, full-page event deep dives, and a chat panel that expands the timeline as users explore.

**Architecture:** React + D3.js frontend with no custom backend. All server-side operations (LLM, Firestore, Wikipedia, search) go through the @calculator-5329/cloud-proxy SDK. Horizontal timeline with parallel color-coded lanes, click-through to event detail pages, chat panel spawns new events.

**Tech Stack:** React 19, Vite 7, TypeScript, D3.js, react-router-dom, @calculator-5329/cloud-proxy

---

### Task 1: Install Dependencies and Scaffold Project Structure

**Files:**
- Modify: `package.json`
- Create: `src/types/index.ts`
- Create: `src/proxy.ts`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`
- Create: `src/pages/TimelinePage.tsx`
- Create: `src/pages/EventPage.tsx`
- Create: `.env`

**Step 1: Install dependencies**

Run:
```bash
npm install d3 react-router-dom @calculator-5329/cloud-proxy
npm install -D @types/d3
```

Expected: packages added to package.json, no errors

**Step 2: Create TypeScript types**

Create `src/types/index.ts`:

```typescript
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
```

**Step 3: Create proxy client**

Create `src/proxy.ts`:

```typescript
import { createClient } from "@calculator-5329/cloud-proxy";

export const proxy = createClient({
  baseUrl: import.meta.env.VITE_PROXY_URL,
  token: import.meta.env.VITE_PROXY_TOKEN,
});
```

**Step 4: Create .env file**

Create `.env`:

```
VITE_PROXY_URL=https://your-cloud-run-service.run.app
VITE_PROXY_TOKEN=your-proxy-token
```

Verify `.env` is in `.gitignore`. If not, add it.

**Step 5: Create placeholder pages**

Create `src/pages/TimelinePage.tsx`:

```tsx
export default function TimelinePage() {
  return <div>Timeline Page</div>;
}
```

Create `src/pages/EventPage.tsx`:

```tsx
export default function EventPage() {
  return <div>Event Page</div>;
}
```

**Step 6: Set up routing in App.tsx**

Replace `src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import TimelinePage from "./pages/TimelinePage";
import EventPage from "./pages/EventPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/topic/ww2" replace />} />
        <Route path="/topic/:topicId" element={<TimelinePage />} />
        <Route path="/topic/:topicId/event/:eventId" element={<EventPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 7: Clean up main.tsx and index.css**

Keep `src/main.tsx` as-is. Replace `src/index.css` with a minimal reset:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #root {
  height: 100%;
  width: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #0a0a0f;
  color: #e0e0e0;
}

a {
  color: inherit;
  text-decoration: none;
}
```

Delete `src/App.css`.

**Step 8: Verify the app runs**

Run: `npm run dev`
Expected: App loads at localhost, navigates to `/topic/ww2`, shows "Timeline Page" text. No console errors.

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold project with routing, types, and proxy client"
```

---

### Task 2: Hardcoded WW2 Sample Data

**Files:**
- Create: `src/data/ww2-sample.ts`

**Step 1: Create sample data**

Create `src/data/ww2-sample.ts` with hardcoded WW2 data for development. This lets us build the timeline visualization without needing Firestore yet.

```typescript
import type { Topic, TimelineEvent } from "../types/index.ts";

export const sampleTopic: Topic = {
  id: "ww2",
  name: "World War II",
  description: "The Second World War, 1939-1945",
  createdAt: "2026-03-07T00:00:00Z",
  branches: [
    { id: "european", name: "European Theater", color: "#4A90D9" },
    { id: "pacific", name: "Pacific Theater", color: "#E74C3C" },
    { id: "homefront", name: "Home Front", color: "#2ECC71" },
    { id: "diplomacy", name: "Diplomacy & Politics", color: "#F39C12" },
  ],
};

export const sampleEvents: TimelineEvent[] = [
  {
    id: "invasion_poland",
    title: "Invasion of Poland",
    date: "1939-09-01",
    branch: "european",
    importance: "critical",
    summary: "Germany invades Poland, triggering declarations of war by Britain and France.",
    sources: [],
    connections: ["britain_declares_war"],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "britain_declares_war",
    title: "Britain & France Declare War",
    date: "1939-09-03",
    branch: "diplomacy",
    importance: "critical",
    summary: "Britain and France declare war on Germany following the invasion of Poland.",
    sources: [],
    connections: ["invasion_poland"],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "dunkirk",
    title: "Dunkirk Evacuation",
    date: "1940-05-26",
    endDate: "1940-06-04",
    branch: "european",
    importance: "critical",
    summary: "Over 338,000 Allied soldiers evacuated from Dunkirk beaches under heavy fire.",
    sources: [],
    connections: ["battle_of_france"],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "battle_of_france",
    title: "Fall of France",
    date: "1940-06-22",
    branch: "european",
    importance: "critical",
    summary: "France signs armistice with Germany after six weeks of fighting.",
    sources: [],
    connections: ["dunkirk"],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "battle_of_britain",
    title: "Battle of Britain",
    date: "1940-07-10",
    endDate: "1940-10-31",
    branch: "european",
    importance: "critical",
    summary: "The Royal Air Force defends Britain against large-scale Luftwaffe attacks.",
    sources: [],
    connections: [],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "lend_lease",
    title: "Lend-Lease Act",
    date: "1941-03-11",
    branch: "diplomacy",
    importance: "major",
    summary: "US begins supplying Allied nations with war materials before officially entering the war.",
    sources: [],
    connections: [],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "barbarossa",
    title: "Operation Barbarossa",
    date: "1941-06-22",
    branch: "european",
    importance: "critical",
    summary: "Germany launches massive invasion of the Soviet Union, opening the Eastern Front.",
    sources: [],
    connections: ["stalingrad"],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "pearl_harbor",
    title: "Attack on Pearl Harbor",
    date: "1941-12-07",
    branch: "pacific",
    importance: "critical",
    summary: "Japan attacks the US naval base at Pearl Harbor, bringing America into the war.",
    sources: [],
    connections: ["us_declares_war"],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "us_declares_war",
    title: "US Declares War",
    date: "1941-12-08",
    branch: "diplomacy",
    importance: "critical",
    summary: "The United States declares war on Japan, and subsequently on Germany and Italy.",
    sources: [],
    connections: ["pearl_harbor"],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "midway",
    title: "Battle of Midway",
    date: "1942-06-04",
    endDate: "1942-06-07",
    branch: "pacific",
    importance: "critical",
    summary: "Decisive US naval victory that turned the tide in the Pacific Theater.",
    sources: [],
    connections: ["pearl_harbor"],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "stalingrad",
    title: "Battle of Stalingrad",
    date: "1942-08-23",
    endDate: "1943-02-02",
    branch: "european",
    importance: "critical",
    summary: "Turning point on the Eastern Front. Soviet victory ended Germany's advance into the USSR.",
    sources: [],
    connections: ["barbarossa"],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "rationing",
    title: "US Rationing Begins",
    date: "1942-01-30",
    branch: "homefront",
    importance: "major",
    summary: "The US government begins rationing consumer goods including sugar, coffee, and gasoline.",
    sources: [],
    connections: [],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "manhattan_project",
    title: "Manhattan Project Begins",
    date: "1942-08-13",
    branch: "homefront",
    importance: "critical",
    summary: "Secret US program to develop atomic weapons begins under Army Corps of Engineers.",
    sources: [],
    connections: ["atomic_bombs"],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "guadalcanal",
    title: "Battle of Guadalcanal",
    date: "1942-08-07",
    endDate: "1943-02-09",
    branch: "pacific",
    importance: "major",
    summary: "First major Allied offensive in the Pacific. Marines secure a key airfield on Guadalcanal.",
    sources: [],
    connections: [],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "italy_campaign",
    title: "Allied Invasion of Sicily",
    date: "1943-07-09",
    branch: "european",
    importance: "major",
    summary: "Allied forces invade Sicily, leading to the fall of Mussolini and Italy's surrender.",
    sources: [],
    connections: [],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "tehran_conference",
    title: "Tehran Conference",
    date: "1943-11-28",
    endDate: "1943-12-01",
    branch: "diplomacy",
    importance: "major",
    summary: "Roosevelt, Churchill, and Stalin meet to coordinate strategy, including plans for D-Day.",
    sources: [],
    connections: ["d_day"],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "d_day",
    title: "D-Day",
    date: "1944-06-06",
    branch: "european",
    importance: "critical",
    summary: "Allied forces land on Normandy beaches in the largest amphibious invasion in history.",
    sources: [],
    connections: ["tehran_conference", "liberation_paris"],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "liberation_paris",
    title: "Liberation of Paris",
    date: "1944-08-25",
    branch: "european",
    importance: "major",
    summary: "Paris is liberated by Allied forces after four years of German occupation.",
    sources: [],
    connections: ["d_day"],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "leyte_gulf",
    title: "Battle of Leyte Gulf",
    date: "1944-10-23",
    endDate: "1944-10-26",
    branch: "pacific",
    importance: "major",
    summary: "Largest naval battle in history. Allied victory secured the liberation of the Philippines.",
    sources: [],
    connections: [],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "battle_of_bulge",
    title: "Battle of the Bulge",
    date: "1944-12-16",
    endDate: "1945-01-25",
    branch: "european",
    importance: "major",
    summary: "Germany's last major offensive on the Western Front. Allied forces repelled the attack.",
    sources: [],
    connections: [],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "yalta_conference",
    title: "Yalta Conference",
    date: "1945-02-04",
    endDate: "1945-02-11",
    branch: "diplomacy",
    importance: "major",
    summary: "Roosevelt, Churchill, and Stalin plan the post-war reorganization of Europe.",
    sources: [],
    connections: [],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "iwo_jima",
    title: "Battle of Iwo Jima",
    date: "1945-02-19",
    endDate: "1945-03-26",
    branch: "pacific",
    importance: "major",
    summary: "Fierce battle for a strategic island. The iconic flag-raising on Mount Suribachi.",
    sources: [],
    connections: [],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "ve_day",
    title: "V-E Day",
    date: "1945-05-08",
    branch: "european",
    importance: "critical",
    summary: "Germany surrenders unconditionally. Victory in Europe is declared.",
    sources: [],
    connections: [],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "atomic_bombs",
    title: "Atomic Bombings",
    date: "1945-08-06",
    endDate: "1945-08-09",
    branch: "pacific",
    importance: "critical",
    summary: "US drops atomic bombs on Hiroshima and Nagasaki, leading to Japan's surrender.",
    sources: [],
    connections: ["manhattan_project", "vj_day"],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "vj_day",
    title: "V-J Day",
    date: "1945-09-02",
    branch: "pacific",
    importance: "critical",
    summary: "Japan formally surrenders aboard USS Missouri. World War II ends.",
    sources: [],
    connections: ["atomic_bombs"],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "rosie_riveter",
    title: "Women Enter the Workforce",
    date: "1942-05-01",
    branch: "homefront",
    importance: "standard",
    summary: "Millions of American women take factory and industrial jobs vacated by men at war.",
    sources: [],
    connections: [],
    generatedBy: "preseed",
    enriched: false,
  },
  {
    id: "japanese_internment",
    title: "Japanese Internment",
    date: "1942-02-19",
    branch: "homefront",
    importance: "major",
    summary: "Executive Order 9066 forces over 120,000 Japanese Americans into internment camps.",
    sources: [],
    connections: [],
    generatedBy: "preseed",
    enriched: false,
  },
];
```

**Step 2: Commit**

```bash
git add src/data/ww2-sample.ts
git commit -m "feat: add hardcoded WW2 sample data for timeline development"
```

---

### Task 3: D3 Timeline Renderer - Basic Layout

**Files:**
- Create: `src/components/Timeline/Timeline.tsx`
- Create: `src/components/Timeline/timeline-renderer.ts`
- Create: `src/components/Timeline/Timeline.css`
- Modify: `src/pages/TimelinePage.tsx`

**Step 1: Create the D3 renderer module**

This is the pure D3 code — no React. It receives a DOM element and data, renders the SVG.

Create `src/components/Timeline/timeline-renderer.ts`:

```typescript
import * as d3 from "d3";
import type { TimelineEvent, Branch } from "../../types/index.ts";

interface RenderOptions {
  container: HTMLDivElement;
  events: TimelineEvent[];
  branches: Branch[];
  onEventClick: (eventId: string) => void;
}

const LANE_HEIGHT = 100;
const LANE_PADDING = 20;
const NODE_SIZES = {
  critical: 14,
  major: 10,
  standard: 7,
  minor: 4,
};
const MARGIN = { top: 60, right: 40, bottom: 40, left: 180 };

export function renderTimeline({ container, events, branches, onEventClick }: RenderOptions) {
  // Clear previous render
  d3.select(container).selectAll("*").remove();

  const width = container.clientWidth;
  const height = MARGIN.top + MARGIN.bottom + branches.length * (LANE_HEIGHT + LANE_PADDING);

  // Time scale
  const dates = events.map((e) => new Date(e.date));
  const timeExtent = d3.extent(dates) as [Date, Date];
  // Add padding to time range
  const timePad = (timeExtent[1].getTime() - timeExtent[0].getTime()) * 0.05;
  const xScale = d3
    .scaleTime()
    .domain([new Date(timeExtent[0].getTime() - timePad), new Date(timeExtent[1].getTime() + timePad)])
    .range([MARGIN.left, width - MARGIN.right]);

  // Lane y positions
  const laneY = new Map<string, number>();
  branches.forEach((b, i) => {
    laneY.set(b.id, MARGIN.top + i * (LANE_HEIGHT + LANE_PADDING) + LANE_HEIGHT / 2);
  });

  // Color map
  const colorMap = new Map<string, string>();
  branches.forEach((b) => colorMap.set(b.id, b.color));

  // Create SVG
  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("background", "#0a0a0f");

  // Main group for zoom/pan
  const g = svg.append("g");

  // Zoom behavior
  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.5, 10])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    });
  svg.call(zoom);

  // Draw lane backgrounds
  branches.forEach((branch) => {
    const y = laneY.get(branch.id)!;
    g.append("rect")
      .attr("x", 0)
      .attr("y", y - LANE_HEIGHT / 2)
      .attr("width", width * 3)
      .attr("height", LANE_HEIGHT)
      .attr("fill", branch.color)
      .attr("opacity", 0.05);

    // Lane divider line
    g.append("line")
      .attr("x1", MARGIN.left)
      .attr("x2", width * 3)
      .attr("y1", y)
      .attr("y2", y)
      .attr("stroke", branch.color)
      .attr("stroke-opacity", 0.2)
      .attr("stroke-width", 1);
  });

  // Draw time axis
  const xAxis = d3.axisTop(xScale).ticks(10).tickFormat(d3.timeFormat("%b %Y") as (d: d3.NumberValue, i: number) => string);
  g.append("g")
    .attr("transform", `translate(0, ${MARGIN.top - 10})`)
    .call(xAxis)
    .attr("color", "#666")
    .selectAll("text")
    .attr("fill", "#888")
    .style("font-size", "11px");

  // Draw cross-branch connections (dotted lines)
  events.forEach((event) => {
    event.connections.forEach((connId) => {
      const target = events.find((e) => e.id === connId);
      if (!target) return;
      const x1 = xScale(new Date(event.date));
      const y1 = laneY.get(event.branch)!;
      const x2 = xScale(new Date(target.date));
      const y2 = laneY.get(target.branch)!;

      if (event.branch !== target.branch) {
        g.append("line")
          .attr("x1", x1)
          .attr("y1", y1)
          .attr("x2", x2)
          .attr("y2", y2)
          .attr("stroke", "#444")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "4,4")
          .attr("opacity", 0.4);
      }
    });
  });

  // Tooltip div
  const tooltip = d3
    .select(container)
    .append("div")
    .style("position", "absolute")
    .style("background", "#1a1a2e")
    .style("border", "1px solid #333")
    .style("border-radius", "6px")
    .style("padding", "8px 12px")
    .style("font-size", "13px")
    .style("color", "#e0e0e0")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("max-width", "250px")
    .style("z-index", "10");

  // Draw event nodes
  events.forEach((event) => {
    const x = xScale(new Date(event.date));
    const y = laneY.get(event.branch)!;
    const r = NODE_SIZES[event.importance];
    const color = colorMap.get(event.branch) || "#888";

    const node = g.append("g").attr("transform", `translate(${x}, ${y})`).style("cursor", "pointer");

    // Glow for critical events
    if (event.importance === "critical") {
      node
        .append("circle")
        .attr("r", r + 4)
        .attr("fill", color)
        .attr("opacity", 0.2);
    }

    // Main circle
    node.append("circle").attr("r", r).attr("fill", color).attr("stroke", "#fff").attr("stroke-width", event.importance === "critical" ? 2 : 1);

    // Star for critical events
    if (event.importance === "critical") {
      node
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "-20")
        .attr("fill", "#FFD700")
        .style("font-size", "14px")
        .text("\u2605");
    }

    // Label
    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", r + 16)
      .attr("fill", "#ccc")
      .style("font-size", event.importance === "critical" ? "12px" : "10px")
      .style("font-weight", event.importance === "critical" ? "bold" : "normal")
      .text(event.title);

    // Interactions
    node
      .on("mouseover", (mouseEvent) => {
        d3.select(mouseEvent.currentTarget as Element)
          .select("circle:last-of-type")
          .transition()
          .duration(150)
          .attr("r", r + 3);
        tooltip
          .html(`<strong>${event.title}</strong><br/><span style="color:#999">${event.date}</span><br/>${event.summary}`)
          .style("opacity", 1)
          .style("left", `${mouseEvent.offsetX + 15}px`)
          .style("top", `${mouseEvent.offsetY - 10}px`);
      })
      .on("mouseout", (mouseEvent) => {
        d3.select(mouseEvent.currentTarget as Element)
          .select("circle:last-of-type")
          .transition()
          .duration(150)
          .attr("r", r);
        tooltip.style("opacity", 0);
      })
      .on("click", () => {
        onEventClick(event.id);
      });
  });

  // Draw lane headers (these stay fixed via a separate SVG overlay)
  const headerSvg = d3
    .select(container)
    .append("svg")
    .attr("width", MARGIN.left)
    .attr("height", height)
    .style("position", "absolute")
    .style("top", "0")
    .style("left", "0")
    .style("pointer-events", "none")
    .style("background", "linear-gradient(to right, #0a0a0f 80%, transparent)");

  branches.forEach((branch) => {
    const y = laneY.get(branch.id)!;

    headerSvg
      .append("rect")
      .attr("x", 10)
      .attr("y", y - 12)
      .attr("width", 4)
      .attr("height", 24)
      .attr("rx", 2)
      .attr("fill", branch.color);

    headerSvg
      .append("text")
      .attr("x", 22)
      .attr("y", y)
      .attr("dy", "0.35em")
      .attr("fill", "#ccc")
      .style("font-size", "13px")
      .style("font-weight", "600")
      .text(branch.name);
  });

  return { svg, zoom };
}
```

**Step 2: Create the React wrapper component**

Create `src/components/Timeline/Timeline.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { renderTimeline } from "./timeline-renderer.ts";
import type { TimelineEvent, Branch } from "../../types/index.ts";
import "./Timeline.css";

interface TimelineProps {
  events: TimelineEvent[];
  branches: Branch[];
  onEventClick: (eventId: string) => void;
}

export default function Timeline({ events, branches, onEventClick }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || events.length === 0) return;

    const result = renderTimeline({
      container: containerRef.current,
      events,
      branches,
      onEventClick,
    });

    return () => {
      result.svg.remove();
    };
  }, [events, branches, onEventClick]);

  return <div ref={containerRef} className="timeline-container" />;
}
```

**Step 3: Create Timeline CSS**

Create `src/components/Timeline/Timeline.css`:

```css
.timeline-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.timeline-container svg {
  display: block;
}
```

**Step 4: Wire up TimelinePage**

Replace `src/pages/TimelinePage.tsx`:

```tsx
import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Timeline from "../components/Timeline/Timeline.tsx";
import { sampleTopic, sampleEvents } from "../data/ww2-sample.ts";

export default function TimelinePage() {
  const navigate = useNavigate();
  const { topicId } = useParams();

  const handleEventClick = useCallback(
    (eventId: string) => {
      navigate(`/topic/${topicId}/event/${eventId}`);
    },
    [navigate, topicId]
  );

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Timeline
        events={sampleEvents}
        branches={sampleTopic.branches}
        onEventClick={handleEventClick}
      />
    </div>
  );
}
```

**Step 5: Verify the timeline renders**

Run: `npm run dev`
Expected: Horizontal timeline with 4 colored lanes, ~27 event nodes, zoom/pan works, hover shows tooltips, click navigates to event page URL.

**Step 6: Commit**

```bash
git add src/components/Timeline/ src/pages/TimelinePage.tsx
git commit -m "feat: D3 timeline renderer with lanes, zoom, tooltips, and click navigation"
```

---

### Task 4: Event Page - Layout and Static Content

**Files:**
- Create: `src/pages/EventPage.css`
- Modify: `src/pages/EventPage.tsx`
- Create: `src/components/EventDetail/EventImage.tsx`
- Create: `src/components/EventDetail/EventContent.tsx`
- Create: `src/components/EventDetail/EventSources.tsx`
- Create: `src/components/EventDetail/RelatedEvents.tsx`

**Step 1: Create EventImage component**

Create `src/components/EventDetail/EventImage.tsx`:

```tsx
interface EventImageProps {
  url?: string;
  alt: string;
}

export default function EventImage({ url, alt }: EventImageProps) {
  if (!url) return null;

  return (
    <div className="event-image">
      <img src={url} alt={alt} />
    </div>
  );
}
```

**Step 2: Create EventContent component**

Create `src/components/EventDetail/EventContent.tsx`:

```tsx
import type { Source } from "../../types/index.ts";

interface EventContentProps {
  content?: string;
  summary: string;
  sources: Source[];
  loading?: boolean;
}

export default function EventContent({ content, summary, sources, loading }: EventContentProps) {
  if (loading) {
    return (
      <div className="event-content">
        <div className="content-skeleton">
          <div className="skeleton-line" style={{ width: "100%" }} />
          <div className="skeleton-line" style={{ width: "90%" }} />
          <div className="skeleton-line" style={{ width: "95%" }} />
          <div className="skeleton-line" style={{ width: "80%" }} />
        </div>
      </div>
    );
  }

  const text = content || summary;

  // Replace [N] citation markers with clickable links
  const rendered = text.replace(/\[(\d+)\]/g, (_match, num) => {
    const idx = parseInt(num) - 1;
    const source = sources[idx];
    if (source) {
      return `<a href="${source.url}" target="_blank" rel="noopener" class="citation" title="${source.title}">[${num}]</a>`;
    }
    return `[${num}]`;
  });

  return (
    <div className="event-content" dangerouslySetInnerHTML={{ __html: rendered }} />
  );
}
```

**Step 3: Create EventSources component**

Create `src/components/EventDetail/EventSources.tsx`:

```tsx
import type { Source } from "../../types/index.ts";

interface EventSourcesProps {
  sources: Source[];
}

export default function EventSources({ sources }: EventSourcesProps) {
  if (sources.length === 0) return null;

  return (
    <div className="event-sources">
      <h3>Sources</h3>
      <ol>
        {sources.map((source, i) => (
          <li key={i}>
            <a href={source.url} target="_blank" rel="noopener">
              {source.title}
            </a>
            {source.snippet && <p className="source-snippet">{source.snippet}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
```

**Step 4: Create RelatedEvents component**

Create `src/components/EventDetail/RelatedEvents.tsx`:

```tsx
import { Link, useParams } from "react-router-dom";
import type { TimelineEvent } from "../../types/index.ts";

interface RelatedEventsProps {
  connections: string[];
  allEvents: TimelineEvent[];
}

export default function RelatedEvents({ connections, allEvents }: RelatedEventsProps) {
  const { topicId } = useParams();
  const related = allEvents.filter((e) => connections.includes(e.id));

  if (related.length === 0) return null;

  return (
    <div className="related-events">
      <h3>Related Events</h3>
      <div className="related-list">
        {related.map((event) => (
          <Link key={event.id} to={`/topic/${topicId}/event/${event.id}`} className="related-card">
            <span className="related-title">{event.title}</span>
            <span className="related-date">{event.date}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

**Step 5: Build the EventPage**

Replace `src/pages/EventPage.tsx`:

```tsx
import { useParams, Link } from "react-router-dom";
import EventImage from "../components/EventDetail/EventImage.tsx";
import EventContent from "../components/EventDetail/EventContent.tsx";
import EventSources from "../components/EventDetail/EventSources.tsx";
import RelatedEvents from "../components/EventDetail/RelatedEvents.tsx";
import { sampleEvents, sampleTopic } from "../data/ww2-sample.ts";
import "./EventPage.css";

export default function EventPage() {
  const { topicId, eventId } = useParams();
  const event = sampleEvents.find((e) => e.id === eventId);
  const branch = sampleTopic.branches.find((b) => b.id === event?.branch);

  if (!event) {
    return (
      <div className="event-page">
        <p>Event not found.</p>
        <Link to={`/topic/${topicId}`}>Back to Timeline</Link>
      </div>
    );
  }

  return (
    <div className="event-page">
      <header className="event-header">
        <Link to={`/topic/${topicId}`} className="back-link">
          &larr; Back to Timeline
        </Link>
        {event.sources.length > 0 && (
          <span className="source-count">Sources: {event.sources.length}</span>
        )}
      </header>

      <main className="event-main">
        <div className="event-title-section">
          {event.importance === "critical" && <span className="importance-star">{"\u2605"}</span>}
          <h1>{event.title}</h1>
          <div className="event-meta">
            <time>{event.date}{event.endDate ? ` \u2013 ${event.endDate}` : ""}</time>
            {branch && (
              <span className="branch-badge" style={{ borderColor: branch.color, color: branch.color }}>
                {branch.name}
              </span>
            )}
          </div>
        </div>

        <EventImage url={event.wikipediaImageUrl} alt={event.title} />
        <EventContent content={event.content} summary={event.summary} sources={event.sources} />
        <RelatedEvents connections={event.connections} allEvents={sampleEvents} />
        <EventSources sources={event.sources} />
      </main>
    </div>
  );
}
```

**Step 6: Create EventPage CSS**

Create `src/pages/EventPage.css`:

```css
.event-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
  min-height: 100vh;
  overflow-y: auto;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.back-link {
  color: #4A90D9;
  font-size: 14px;
  transition: opacity 0.2s;
}

.back-link:hover {
  opacity: 0.8;
}

.source-count {
  color: #888;
  font-size: 13px;
}

.event-title-section {
  margin-bottom: 24px;
}

.importance-star {
  color: #FFD700;
  font-size: 24px;
}

.event-title-section h1 {
  font-size: 32px;
  font-weight: 700;
  margin: 4px 0 8px;
  color: #f0f0f0;
}

.event-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #888;
  font-size: 14px;
}

.branch-badge {
  border: 1px solid;
  border-radius: 12px;
  padding: 2px 10px;
  font-size: 12px;
}

.event-image {
  margin-bottom: 24px;
  border-radius: 8px;
  overflow: hidden;
}

.event-image img {
  width: 100%;
  max-height: 400px;
  object-fit: cover;
}

.event-content {
  font-size: 16px;
  line-height: 1.7;
  color: #ccc;
  margin-bottom: 32px;
}

.citation {
  color: #4A90D9;
  font-size: 12px;
  vertical-align: super;
  text-decoration: none;
}

.citation:hover {
  text-decoration: underline;
}

.content-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-line {
  height: 16px;
  background: linear-gradient(90deg, #1a1a2e 25%, #252540 50%, #1a1a2e 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.related-events {
  margin-bottom: 32px;
}

.related-events h3,
.event-sources h3 {
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #666;
  margin-bottom: 12px;
  border-top: 1px solid #222;
  padding-top: 24px;
}

.related-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.related-card {
  display: flex;
  justify-content: space-between;
  padding: 10px 14px;
  background: #1a1a2e;
  border-radius: 6px;
  border: 1px solid #252540;
  transition: border-color 0.2s;
}

.related-card:hover {
  border-color: #4A90D9;
}

.related-title {
  color: #e0e0e0;
  font-weight: 500;
}

.related-date {
  color: #666;
  font-size: 13px;
}

.event-sources ol {
  list-style: none;
  counter-reset: source-counter;
}

.event-sources li {
  counter-increment: source-counter;
  margin-bottom: 12px;
  padding-left: 28px;
  position: relative;
}

.event-sources li::before {
  content: "[" counter(source-counter) "]";
  position: absolute;
  left: 0;
  color: #4A90D9;
  font-size: 13px;
}

.event-sources a {
  color: #4A90D9;
  text-decoration: none;
}

.event-sources a:hover {
  text-decoration: underline;
}

.source-snippet {
  color: #888;
  font-size: 13px;
  margin-top: 2px;
}
```

**Step 7: Verify**

Run: `npm run dev`
Expected: Click any event on the timeline, navigates to event page showing title, date, branch badge, summary text, related events as clickable cards. Back button returns to timeline.

**Step 8: Commit**

```bash
git add src/components/EventDetail/ src/pages/EventPage.tsx src/pages/EventPage.css
git commit -m "feat: event detail page with content, sources, related events, and styling"
```

---

### Task 5: Firestore Integration - Hooks for Reading Data

**Files:**
- Create: `src/hooks/useTimeline.ts`
- Create: `src/hooks/useEvent.ts`
- Modify: `src/pages/TimelinePage.tsx`
- Modify: `src/pages/EventPage.tsx`

**Step 1: Create useTimeline hook**

Create `src/hooks/useTimeline.ts`:

```typescript
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
```

**Step 2: Create useEvent hook**

Create `src/hooks/useEvent.ts`:

```typescript
import { useState, useEffect } from "react";
import { proxy } from "../proxy.ts";
import type { TimelineEvent } from "../types/index.ts";

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
        const doc = await proxy.firestore.get<TimelineEvent>(
          `topics/${topicId}/events/${eventId}`
        );
        if (cancelled) return;
        setEvent({ ...doc, id: eventId } as TimelineEvent);
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
```

**Step 3: Update TimelinePage to support both sample data and Firestore**

Replace `src/pages/TimelinePage.tsx`:

```tsx
import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Timeline from "../components/Timeline/Timeline.tsx";
import { useTimeline } from "../hooks/useTimeline.ts";
import { sampleTopic, sampleEvents } from "../data/ww2-sample.ts";

export default function TimelinePage() {
  const navigate = useNavigate();
  const { topicId } = useParams();
  const { topic, events, loading, error } = useTimeline(topicId);

  // Fall back to sample data if Firestore fails or is empty
  const activeTopic = topic || sampleTopic;
  const activeEvents = events.length > 0 ? events : sampleEvents;

  const handleEventClick = useCallback(
    (eventId: string) => {
      navigate(`/topic/${topicId}/event/${eventId}`);
    },
    [navigate, topicId]
  );

  if (loading) {
    return (
      <div style={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>
        Loading timeline...
      </div>
    );
  }

  if (error) {
    // Silently fall back to sample data
    console.warn("Firestore error, using sample data:", error);
  }

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Timeline
        events={activeEvents}
        branches={activeTopic.branches}
        onEventClick={handleEventClick}
      />
    </div>
  );
}
```

**Step 4: Update EventPage to support Firestore with sample data fallback**

Replace `src/pages/EventPage.tsx`:

```tsx
import { useParams, Link } from "react-router-dom";
import EventImage from "../components/EventDetail/EventImage.tsx";
import EventContent from "../components/EventDetail/EventContent.tsx";
import EventSources from "../components/EventDetail/EventSources.tsx";
import RelatedEvents from "../components/EventDetail/RelatedEvents.tsx";
import { useEvent } from "../hooks/useEvent.ts";
import { useTimeline } from "../hooks/useTimeline.ts";
import { sampleEvents, sampleTopic } from "../data/ww2-sample.ts";
import "./EventPage.css";

export default function EventPage() {
  const { topicId, eventId } = useParams();
  const { event: firestoreEvent, loading: eventLoading } = useEvent(topicId, eventId);
  const { topic, events: allEvents } = useTimeline(topicId);

  // Fall back to sample data
  const event = firestoreEvent || sampleEvents.find((e) => e.id === eventId);
  const activeTopic = topic || sampleTopic;
  const activeEvents = allEvents.length > 0 ? allEvents : sampleEvents;
  const branch = activeTopic.branches.find((b) => b.id === event?.branch);

  if (eventLoading) {
    return (
      <div className="event-page">
        <p style={{ color: "#888" }}>Loading event...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="event-page">
        <p>Event not found.</p>
        <Link to={`/topic/${topicId}`}>Back to Timeline</Link>
      </div>
    );
  }

  return (
    <div className="event-page">
      <header className="event-header">
        <Link to={`/topic/${topicId}`} className="back-link">
          &larr; Back to Timeline
        </Link>
        {event.sources.length > 0 && (
          <span className="source-count">Sources: {event.sources.length}</span>
        )}
      </header>

      <main className="event-main">
        <div className="event-title-section">
          {event.importance === "critical" && <span className="importance-star">{"\u2605"}</span>}
          <h1>{event.title}</h1>
          <div className="event-meta">
            <time>{event.date}{event.endDate ? ` \u2013 ${event.endDate}` : ""}</time>
            {branch && (
              <span className="branch-badge" style={{ borderColor: branch.color, color: branch.color }}>
                {branch.name}
              </span>
            )}
          </div>
        </div>

        <EventImage url={event.wikipediaImageUrl} alt={event.title} />
        <EventContent content={event.content} summary={event.summary} sources={event.sources} />
        <RelatedEvents connections={event.connections} allEvents={activeEvents} />
        <EventSources sources={event.sources} />
      </main>
    </div>
  );
}
```

**Step 5: Verify**

Run: `npm run dev`
Expected: App still works with sample data fallback. If Firestore is configured, it loads from there instead.

**Step 6: Commit**

```bash
git add src/hooks/ src/pages/TimelinePage.tsx src/pages/EventPage.tsx
git commit -m "feat: Firestore hooks with sample data fallback for timeline and events"
```

---

### Task 6: Event Enrichment Service

**Files:**
- Create: `src/services/event-enricher.ts`
- Modify: `src/pages/EventPage.tsx`

**Step 1: Create the enrichment service**

Create `src/services/event-enricher.ts`:

```typescript
import { proxy } from "../proxy.ts";
import type { TimelineEvent } from "../types/index.ts";

export async function enrichEvent(
  topicId: string,
  event: TimelineEvent
): Promise<TimelineEvent> {
  if (event.enriched) return event;

  try {
    // Use the proxy agent's enrichEvent which handles Wikipedia + search
    const result = await proxy.agent.enrichEvent({
      timelineId: topicId,
      eventId: event.id,
      event: {
        title: event.title,
        date: event.date,
        wikipedia_search_query: event.wikipediaSearchQuery || event.title,
      },
    });

    const updated: Partial<TimelineEvent> = {
      enriched: true,
      wikipediaImageUrl: result.wikipediaImageUrl || event.wikipediaImageUrl,
      wikipediaExtract: result.wikipediaExtract || event.wikipediaExtract,
      sources: result.sources || event.sources,
    };

    // Update Firestore
    await proxy.firestore.patch(`topics/${topicId}/events/${event.id}`, updated);

    return { ...event, ...updated };
  } catch (err) {
    console.error("Enrichment failed:", err);
    return event;
  }
}

export async function generateEventContent(
  topicId: string,
  event: TimelineEvent
): Promise<string> {
  if (event.content) return event.content;

  // Build source context for the LLM
  const sourceContext = event.sources
    .map((s, i) => `[${i + 1}] ${s.title}: ${s.snippet}`)
    .join("\n");

  const response = await proxy.ai.chat({
    provider: "openai",
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a historian writing an engaging, detailed explanation of a historical event. Use inline citations [1], [2], etc. referencing the provided sources. Be factual. Do not invent claims without source backing. Write 2-4 paragraphs.`,
      },
      {
        role: "user",
        content: `Write about: ${event.title} (${event.date})

Summary: ${event.summary}

${event.wikipediaExtract ? `Wikipedia context: ${event.wikipediaExtract}` : ""}

Available sources:
${sourceContext || "No sources available yet. Write based on well-known historical facts and note that sources are being gathered."}`,
      },
    ],
    maxTokens: 1024,
  });

  const content = response.content;

  // Save to Firestore
  await proxy.firestore.patch(`topics/${topicId}/events/${event.id}`, { content });

  return content;
}
```

**Step 2: Add enrichment trigger to EventPage**

Replace `src/pages/EventPage.tsx`:

```tsx
import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import EventImage from "../components/EventDetail/EventImage.tsx";
import EventContent from "../components/EventDetail/EventContent.tsx";
import EventSources from "../components/EventDetail/EventSources.tsx";
import RelatedEvents from "../components/EventDetail/RelatedEvents.tsx";
import { useEvent } from "../hooks/useEvent.ts";
import { useTimeline } from "../hooks/useTimeline.ts";
import { enrichEvent, generateEventContent } from "../services/event-enricher.ts";
import { sampleEvents, sampleTopic } from "../data/ww2-sample.ts";
import "./EventPage.css";

export default function EventPage() {
  const { topicId, eventId } = useParams();
  const { event: firestoreEvent, loading: eventLoading, setEvent } = useEvent(topicId, eventId);
  const { topic, events: allEvents } = useTimeline(topicId);
  const [contentLoading, setContentLoading] = useState(false);

  // Fall back to sample data
  const event = firestoreEvent || sampleEvents.find((e) => e.id === eventId);
  const activeTopic = topic || sampleTopic;
  const activeEvents = allEvents.length > 0 ? allEvents : sampleEvents;
  const branch = activeTopic.branches.find((b) => b.id === event?.branch);

  // Trigger enrichment on mount if needed
  useEffect(() => {
    if (!event || !topicId || !firestoreEvent) return;

    let cancelled = false;

    async function doEnrich() {
      if (!event || !topicId) return;

      // Step 1: Enrich (Wikipedia + sources) if not already done
      let enriched = event;
      if (!event.enriched) {
        enriched = await enrichEvent(topicId, event);
        if (cancelled) return;
        setEvent(enriched);
      }

      // Step 2: Generate content if not already done
      if (!enriched.content) {
        setContentLoading(true);
        const content = await generateEventContent(topicId, enriched);
        if (cancelled) return;
        setEvent({ ...enriched, content });
        setContentLoading(false);
      }
    }

    doEnrich();

    return () => {
      cancelled = true;
    };
  }, [event?.id, event?.enriched, event?.content, topicId, firestoreEvent, setEvent]);

  if (eventLoading) {
    return (
      <div className="event-page">
        <p style={{ color: "#888" }}>Loading event...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="event-page">
        <p>Event not found.</p>
        <Link to={`/topic/${topicId}`}>Back to Timeline</Link>
      </div>
    );
  }

  return (
    <div className="event-page">
      <header className="event-header">
        <Link to={`/topic/${topicId}`} className="back-link">
          &larr; Back to Timeline
        </Link>
        {event.sources.length > 0 && (
          <span className="source-count">Sources: {event.sources.length}</span>
        )}
      </header>

      <main className="event-main">
        <div className="event-title-section">
          {event.importance === "critical" && <span className="importance-star">{"\u2605"}</span>}
          <h1>{event.title}</h1>
          <div className="event-meta">
            <time>{event.date}{event.endDate ? ` \u2013 ${event.endDate}` : ""}</time>
            {branch && (
              <span className="branch-badge" style={{ borderColor: branch.color, color: branch.color }}>
                {branch.name}
              </span>
            )}
          </div>
        </div>

        <EventImage url={event.wikipediaImageUrl} alt={event.title} />
        <EventContent
          content={event.content}
          summary={event.summary}
          sources={event.sources}
          loading={contentLoading}
        />
        <RelatedEvents connections={event.connections} allEvents={activeEvents} />
        <EventSources sources={event.sources} />
      </main>
    </div>
  );
}
```

**Step 3: Verify**

Run: `npm run dev`
Expected: When viewing an event page backed by Firestore data, enrichment triggers automatically. Wikipedia image appears, sources populate, then full content generates with inline citations. Sample data fallback still works without enrichment.

**Step 4: Commit**

```bash
git add src/services/event-enricher.ts src/pages/EventPage.tsx
git commit -m "feat: event enrichment service with Wikipedia, search, and LLM content generation"
```

---

### Task 7: Chat Panel with Event Spawning

**Files:**
- Create: `src/services/chat-service.ts`
- Create: `src/hooks/useChat.ts`
- Create: `src/components/Chat/ChatPanel.tsx`
- Create: `src/components/Chat/ChatPanel.css`
- Create: `src/components/Chat/ChatMessage.tsx`
- Create: `src/components/Chat/AddedEventIndicator.tsx`
- Modify: `src/pages/EventPage.tsx`

**Step 1: Create chat service**

Create `src/services/chat-service.ts`:

```typescript
import { proxy } from "../proxy.ts";
import type { TimelineEvent, ChatMessage, Source } from "../types/index.ts";
import { enrichEvent } from "./event-enricher.ts";

interface ChatResponse {
  message: ChatMessage;
  addedEvents: TimelineEvent[];
}

const CHAT_SYSTEM_PROMPT = `You are an expert historian. The user is exploring a historical event on an interactive timeline. Answer their questions with accurate, engaging information.

IMPORTANT RULES:
1. Always cite sources when making specific claims.
2. If your answer references historical events NOT currently on the timeline, output them as a JSON block at the end of your response in this exact format:

\`\`\`json
{"addedEvents": [{"title": "Event Name", "date": "YYYY-MM-DD", "branch": "branch_id", "importance": "major", "summary": "One sentence summary.", "wikipediaSearchQuery": "Search query for Wikipedia"}]}
\`\`\`

Valid branch IDs: european, pacific, homefront, diplomacy
Valid importance: critical, major, standard, minor

3. Only add events that are directly relevant to the user's question and historically significant.
4. If uncertain about dates, use your best historical knowledge and note the uncertainty.`;

export async function sendChatMessage(
  topicId: string,
  event: TimelineEvent,
  messages: ChatMessage[],
  userMessage: string
): Promise<ChatResponse> {
  const eventContext = `Current event: "${event.title}" (${event.date})
Branch: ${event.branch}
Summary: ${event.summary}
${event.content ? `Detail: ${event.content}` : ""}`;

  const response = await proxy.ai.chat({
    provider: "openai",
    model: "gpt-4o",
    messages: [
      { role: "system", content: CHAT_SYSTEM_PROMPT },
      { role: "user", content: eventContext },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage },
    ],
    maxTokens: 1500,
  });

  const fullText = response.content;

  // Parse added events from JSON block
  let addedEvents: TimelineEvent[] = [];
  let displayText = fullText;

  const jsonMatch = fullText.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.addedEvents && Array.isArray(parsed.addedEvents)) {
        // Remove JSON block from display text
        displayText = fullText.replace(/```json[\s\S]*?```/, "").trim();

        // Write each new event to Firestore
        const createdEvents: TimelineEvent[] = [];
        for (const ev of parsed.addedEvents) {
          const newEvent: Omit<TimelineEvent, "id"> = {
            title: ev.title,
            date: ev.date,
            branch: ev.branch || "european",
            importance: ev.importance || "standard",
            summary: ev.summary,
            sources: [],
            connections: [event.id],
            generatedBy: "chat",
            enriched: false,
            wikipediaSearchQuery: ev.wikipediaSearchQuery || ev.title,
          };

          const created = await proxy.firestore.create(
            `topics/${topicId}/events`,
            newEvent
          );

          const createdEvent = { ...newEvent, id: created.id } as TimelineEvent;
          createdEvents.push(createdEvent);

          // Trigger async enrichment (don't await)
          enrichEvent(topicId, createdEvent).catch(console.error);
        }

        addedEvents = createdEvents;
      }
    } catch {
      // JSON parse failed, just show full text
      displayText = fullText;
    }
  }

  const assistantMessage: ChatMessage = {
    role: "assistant",
    content: displayText,
    addedEvents: addedEvents.map((e) => e.id),
  };

  return { message: assistantMessage, addedEvents };
}
```

**Step 2: Create useChat hook**

Create `src/hooks/useChat.ts`:

```typescript
import { useState, useCallback } from "react";
import { sendChatMessage } from "../services/chat-service.ts";
import type { TimelineEvent, ChatMessage } from "../types/index.ts";

export function useChat(topicId: string | undefined, event: TimelineEvent | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [addedEventIds, setAddedEventIds] = useState<string[]>([]);

  const send = useCallback(
    async (userMessage: string) => {
      if (!topicId || !event || sending) return;

      const userMsg: ChatMessage = { role: "user", content: userMessage };
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);

      try {
        const { message, addedEvents } = await sendChatMessage(
          topicId,
          event,
          messages,
          userMessage
        );
        setMessages((prev) => [...prev, message]);
        if (addedEvents.length > 0) {
          setAddedEventIds((prev) => [...prev, ...addedEvents.map((e) => e.id)]);
        }
      } catch (err) {
        const errorMsg: ChatMessage = {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        };
        setMessages((prev) => [...prev, errorMsg]);
        console.error("Chat error:", err);
      } finally {
        setSending(false);
      }
    },
    [topicId, event, messages, sending]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setAddedEventIds([]);
  }, []);

  return { messages, sending, send, reset, addedEventIds };
}
```

**Step 3: Create AddedEventIndicator component**

Create `src/components/Chat/AddedEventIndicator.tsx`:

```tsx
interface AddedEventIndicatorProps {
  eventIds: string[];
  allEventsTitle?: Map<string, string>;
}

export default function AddedEventIndicator({ eventIds }: AddedEventIndicatorProps) {
  if (eventIds.length === 0) return null;

  return (
    <div className="added-events-indicator">
      {eventIds.map((id) => (
        <div key={id} className="added-event-badge">
          + Added to timeline
        </div>
      ))}
    </div>
  );
}
```

**Step 4: Create ChatMessage component**

Create `src/components/Chat/ChatMessage.tsx`:

```tsx
import type { ChatMessage as ChatMessageType } from "../../types/index.ts";
import AddedEventIndicator from "./AddedEventIndicator.tsx";

interface ChatMessageProps {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className={`chat-message chat-message-${message.role}`}>
      <div className="chat-message-content">{message.content}</div>
      {message.addedEvents && message.addedEvents.length > 0 && (
        <AddedEventIndicator eventIds={message.addedEvents} />
      )}
    </div>
  );
}
```

**Step 5: Create ChatPanel component**

Create `src/components/Chat/ChatPanel.tsx`:

```tsx
import { useState, useRef, useEffect } from "react";
import ChatMessage from "./ChatMessage.tsx";
import type { ChatMessage as ChatMessageType } from "../../types/index.ts";
import "./ChatPanel.css";

interface ChatPanelProps {
  messages: ChatMessageType[];
  sending: boolean;
  onSend: (message: string) => void;
}

export default function ChatPanel({ messages, sending, onSend }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    onSend(trimmed);
    setInput("");
  };

  return (
    <div className="chat-panel">
      <h3 className="chat-title">Ask about this event</h3>

      {messages.length > 0 && (
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}
          {sending && (
            <div className="chat-message chat-message-assistant">
              <div className="chat-typing">Thinking...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What was happening in the Pacific at this time?"
          disabled={sending}
          className="chat-input"
        />
        <button type="submit" disabled={sending || !input.trim()} className="chat-send">
          Send
        </button>
      </form>
    </div>
  );
}
```

**Step 6: Create ChatPanel CSS**

Create `src/components/Chat/ChatPanel.css`:

```css
.chat-panel {
  border-top: 1px solid #222;
  padding-top: 24px;
  margin-top: 32px;
}

.chat-title {
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #666;
  margin-bottom: 16px;
}

.chat-messages {
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-message {
  padding: 10px 14px;
  border-radius: 8px;
  max-width: 85%;
}

.chat-message-user {
  background: #1a3a5c;
  align-self: flex-end;
  color: #e0e0e0;
}

.chat-message-assistant {
  background: #1a1a2e;
  align-self: flex-start;
  color: #ccc;
  border: 1px solid #252540;
}

.chat-message-content {
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.chat-typing {
  color: #888;
  font-style: italic;
  font-size: 14px;
}

.added-events-indicator {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.added-event-badge {
  font-size: 12px;
  color: #2ECC71;
  padding: 4px 8px;
  background: rgba(46, 204, 113, 0.1);
  border-radius: 4px;
  border: 1px solid rgba(46, 204, 113, 0.2);
}

.chat-input-form {
  display: flex;
  gap: 8px;
}

.chat-input {
  flex: 1;
  padding: 10px 14px;
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 8px;
  color: #e0e0e0;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.chat-input:focus {
  border-color: #4A90D9;
}

.chat-input::placeholder {
  color: #555;
}

.chat-input:disabled {
  opacity: 0.5;
}

.chat-send {
  padding: 10px 20px;
  background: #4A90D9;
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.chat-send:hover:not(:disabled) {
  opacity: 0.9;
}

.chat-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

**Step 7: Add ChatPanel to EventPage**

Add the chat panel import and usage to `src/pages/EventPage.tsx`. Add these imports at the top:

```tsx
import ChatPanel from "../components/Chat/ChatPanel.tsx";
import { useChat } from "../hooks/useChat.ts";
```

Inside the component, add the hook call after other hooks:

```tsx
const { messages, sending, send } = useChat(topicId, event || null);
```

Add the ChatPanel at the end of `<main className="event-main">`, after EventSources:

```tsx
<ChatPanel messages={messages} sending={sending} onSend={send} />
```

**Step 8: Verify**

Run: `npm run dev`
Expected: Event page now has a chat panel at the bottom. Typing a question and hitting Send calls the LLM. Responses appear as chat bubbles. If the LLM mentions new events, they get created in Firestore and show the green "Added to timeline" indicator.

**Step 9: Commit**

```bash
git add src/components/Chat/ src/hooks/useChat.ts src/services/chat-service.ts src/pages/EventPage.tsx
git commit -m "feat: chat panel with LLM integration and automatic event spawning"
```

---

### Task 8: Pre-seed Script

**Files:**
- Create: `src/scripts/preseed.ts`
- Modify: `package.json` (add script)

**Step 1: Create the pre-seed script**

Create `src/scripts/preseed.ts`:

```typescript
import { createClient } from "@calculator-5329/cloud-proxy";

const proxy = createClient({
  baseUrl: process.env.PROXY_URL!,
  token: process.env.PROXY_TOKEN!,
});

const WW2_BRANCHES = [
  { id: "european", name: "European Theater", color: "#4A90D9" },
  { id: "pacific", name: "Pacific Theater", color: "#E74C3C" },
  { id: "homefront", name: "Home Front", color: "#2ECC71" },
  { id: "diplomacy", name: "Diplomacy & Politics", color: "#F39C12" },
];

const GENERATION_PROMPT = `Generate a comprehensive World War II timeline with 50-60 key events across these branches:
- european: European Theater (military operations in Europe and North Africa)
- pacific: Pacific Theater (military operations in the Pacific and Asia)
- homefront: Home Front (civilian life, manufacturing, social changes)
- diplomacy: Diplomacy & Politics (conferences, declarations, treaties)

Return ONLY a JSON array. Each event object must have:
- title: string (concise event name)
- date: string (ISO format YYYY-MM-DD, use best known date)
- endDate: string or null (for events spanning multiple days)
- branch: string (one of: european, pacific, homefront, diplomacy)
- importance: string (one of: critical, major, standard, minor)
  - critical: ~10 events that fundamentally changed the war's course
  - major: ~15 events of significant military or political importance
  - standard: ~15 notable events
  - minor: ~10 smaller but interesting events
- summary: string (1-2 sentences, factual)
- wikipediaSearchQuery: string (exact Wikipedia article title for this event)
- connections: string[] (titles of other events in this list that are directly related)

Be historically accurate. Cover the full span of the war (1939-1945). Ensure good coverage across all four branches.`;

async function preseed() {
  console.log("Starting WW2 pre-seed...");

  // Step 1: Create the topic document
  console.log("Creating topic document...");
  const topicData = {
    name: "World War II",
    description: "The Second World War, 1939-1945. The deadliest conflict in human history.",
    createdAt: new Date().toISOString(),
    branches: WW2_BRANCHES,
  };

  try {
    await proxy.firestore.get("topics/ww2");
    console.log("Topic already exists, updating...");
    await proxy.firestore.update("topics/ww2", topicData);
  } catch {
    console.log("Creating new topic...");
    await proxy.firestore.create("topics", { ...topicData, id: "ww2" });
  }

  // Step 2: Generate events via LLM
  console.log("Generating events via LLM...");
  const response = await proxy.ai.chat({
    provider: "openai",
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a historian. Return only valid JSON, no markdown fences, no explanation.",
      },
      { role: "user", content: GENERATION_PROMPT },
    ],
    maxTokens: 8000,
  });

  let events: Array<{
    title: string;
    date: string;
    endDate?: string;
    branch: string;
    importance: string;
    summary: string;
    wikipediaSearchQuery: string;
    connections: string[];
  }>;

  try {
    const cleaned = response.content.replace(/```json\n?|```\n?/g, "").trim();
    events = JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse LLM response:", err);
    console.error("Raw response:", response.content);
    process.exit(1);
  }

  console.log(`Generated ${events.length} events. Writing to Firestore...`);

  // Step 3: Write events to Firestore
  // First pass: create all events and build a title->id map
  const titleToId = new Map<string, string>();

  for (const event of events) {
    const doc = await proxy.firestore.create(`topics/ww2/events`, {
      title: event.title,
      date: event.date,
      endDate: event.endDate || null,
      branch: event.branch,
      importance: event.importance,
      summary: event.summary,
      sources: [],
      connections: [], // will be filled in second pass
      generatedBy: "preseed",
      enriched: false,
      wikipediaSearchQuery: event.wikipediaSearchQuery,
    });

    titleToId.set(event.title, doc.id);
    console.log(`  Created: ${event.title} (${doc.id})`);
  }

  // Second pass: resolve connections (title references -> IDs)
  console.log("Resolving connections...");
  for (const event of events) {
    const eventId = titleToId.get(event.title);
    if (!eventId) continue;

    const connectionIds = event.connections
      .map((title) => titleToId.get(title))
      .filter((id): id is string => id !== undefined);

    if (connectionIds.length > 0) {
      await proxy.firestore.patch(`topics/ww2/events/${eventId}`, {
        connections: connectionIds,
      });
    }
  }

  // Step 4: Enrich events (Wikipedia + search)
  console.log("Enriching events (this may take a few minutes)...");
  for (const event of events) {
    const eventId = titleToId.get(event.title);
    if (!eventId) continue;

    try {
      await proxy.agent.enrichEvent({
        timelineId: "ww2",
        eventId,
        event: {
          title: event.title,
          date: event.date,
          wikipedia_search_query: event.wikipediaSearchQuery,
        },
      });
      console.log(`  Enriched: ${event.title}`);
    } catch (err) {
      console.warn(`  Failed to enrich ${event.title}:`, err);
    }

    // Rate limit: 500ms between enrichment calls
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("Pre-seed complete!");
}

preseed().catch(console.error);
```

**Step 2: Add preseed script to package.json**

Add to the `"scripts"` section in `package.json`:

```json
"preseed": "npx tsx src/scripts/preseed.ts"
```

Note: This requires `PROXY_URL` and `PROXY_TOKEN` as environment variables (not `VITE_` prefixed since it runs outside Vite). Run with:

```bash
PROXY_URL=https://your-service.run.app PROXY_TOKEN=your-token npm run preseed
```

**Step 3: Commit**

```bash
git add src/scripts/preseed.ts package.json
git commit -m "feat: pre-seed script to generate and enrich WW2 timeline via LLM"
```

---

### Task 9: Timeline Polish - Zoom Filtering and Resize

**Files:**
- Modify: `src/components/Timeline/timeline-renderer.ts`
- Modify: `src/components/Timeline/Timeline.tsx`

**Step 1: Add zoom-based importance filtering to timeline-renderer.ts**

Update the `renderTimeline` function to show/hide events based on zoom level. In the zoom handler, add visibility logic:

After the zoom behavior definition, replace the `.on("zoom", ...)` callback:

```typescript
.on("zoom", (event) => {
  g.attr("transform", event.transform);
  const k = event.transform.k;

  // Show/hide events based on zoom level
  g.selectAll<SVGGElement, TimelineEvent>(".event-node").each(function (d) {
    const el = d3.select(this);
    if (d.importance === "minor") {
      el.style("display", k >= 3 ? "block" : "none");
    } else if (d.importance === "standard") {
      el.style("display", k >= 1.5 ? "block" : "none");
    }
  });
});
```

Also update the event node creation to add the class and data binding. Replace the event node `g.append("g")` block to include a class and datum:

```typescript
const node = g
  .append("g")
  .datum(event)
  .attr("class", "event-node")
  .attr("transform", `translate(${x}, ${y})`)
  .style("cursor", "pointer")
  .style("display", event.importance === "minor" || event.importance === "standard" ? "none" : "block");
```

**Step 2: Add resize handling to Timeline.tsx**

Update `src/components/Timeline/Timeline.tsx` to re-render on window resize:

```tsx
import { useEffect, useRef } from "react";
import { renderTimeline } from "./timeline-renderer.ts";
import type { TimelineEvent, Branch } from "../../types/index.ts";
import "./Timeline.css";

interface TimelineProps {
  events: TimelineEvent[];
  branches: Branch[];
  onEventClick: (eventId: string) => void;
}

export default function Timeline({ events, branches, onEventClick }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || events.length === 0) return;

    function render() {
      if (!containerRef.current) return;
      // Clear previous
      containerRef.current.innerHTML = "";
      renderTimeline({
        container: containerRef.current,
        events,
        branches,
        onEventClick,
      });
    }

    render();

    const handleResize = () => render();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [events, branches, onEventClick]);

  return <div ref={containerRef} className="timeline-container" />;
}
```

**Step 3: Verify**

Run: `npm run dev`
Expected: At default zoom, only critical and major events are visible. Zooming in reveals standard events at 1.5x and minor events at 3x. Resizing the window re-renders the timeline.

**Step 4: Commit**

```bash
git add src/components/Timeline/
git commit -m "feat: zoom-based importance filtering and window resize handling"
```

---

### Task 10: Final Integration and Cleanup

**Files:**
- Modify: `src/App.tsx` (ensure clean routing)
- Delete: `src/assets/react.svg` (unused)
- Verify: `.gitignore` includes `.env`

**Step 1: Clean up unused files**

Delete `src/assets/react.svg` (from the Vite template).
Delete `src/App.css` if it still exists.

**Step 2: Verify .gitignore**

Ensure `.gitignore` includes:
```
.env
.env.local
.env.*.local
```

**Step 3: Run full type check**

Run: `npx tsc --noEmit`
Expected: No type errors. Fix any that appear.

**Step 4: Run dev server and smoke test**

Run: `npm run dev`

Smoke test checklist:
- [ ] `/` redirects to `/topic/ww2`
- [ ] Timeline renders with 4 lanes and event nodes
- [ ] Zoom/pan works smoothly
- [ ] Hover shows tooltip with event summary
- [ ] Click event navigates to event page
- [ ] Event page shows title, date, branch badge, summary
- [ ] Related events are clickable and navigate correctly
- [ ] Back button returns to timeline
- [ ] Chat panel accepts input and shows messages (requires proxy connection)

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: cleanup unused template files and verify integration"
```
