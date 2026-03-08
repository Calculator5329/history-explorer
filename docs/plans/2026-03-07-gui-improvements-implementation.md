# GUI Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul the history explorer GUI with smart label placement, event-type icons, a geographic mini-map, multiple images per event, and a dark military/historical aesthetic.

**Architecture:** Five independent visual improvement areas applied to the existing React + D3.js timeline app. Types are extended with `eventType` and `region` fields. The timeline renderer gets collision detection, SVG icons, bezier curves, and a mini-map overlay. The event page gets an image gallery and restyled components. Global CSS is overhauled with new fonts, colors, and textures.

**Tech Stack:** React 19, D3.js 7, TypeScript, CSS (no new dependencies — Google Fonts loaded via CSS `@import`)

---

## Task 1: Extend TypeScript Types

**Files:**
- Modify: `src/types/index.ts:12-29`

**Step 1: Add eventType and region to TimelineEvent**

Add `eventType` and `region` fields to the `TimelineEvent` interface. Also add `images` array for multiple images.

```typescript
// In src/types/index.ts

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
  eventType?: EventType;          // NEW
  region?: Region;                 // NEW
  summary: string;
  content?: string;
  wikipediaImageUrl?: string;
  wikipediaExtract?: string;
  images?: EventImage[];           // NEW
  sources: Source[];
  connections: string[];
  generatedBy: "preseed" | "chat" | "enrichment";
  enriched: boolean;
  wikipediaSearchQuery?: string;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors (fields are optional, so existing code still compiles)

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add eventType, region, images fields to TimelineEvent"
```

---

## Task 2: Add eventType and region to Sample Data

**Files:**
- Modify: `src/data/ww2-sample.ts:16-352`

**Step 1: Add eventType and region to every event in sampleEvents**

Add the appropriate `eventType` and `region` to each of the 27 events. Here is the mapping:

| Event ID | eventType | region |
|----------|-----------|--------|
| invasion_poland | invasion | eastern_europe |
| britain_declares_war | declaration | western_europe |
| dunkirk | evacuation | western_europe |
| battle_of_france | invasion | western_europe |
| battle_of_britain | bombing | western_europe |
| lend_lease | political | north_america |
| barbarossa | invasion | eastern_europe |
| pearl_harbor | naval | pacific |
| us_declares_war | declaration | north_america |
| midway | naval | pacific |
| stalingrad | battle | eastern_europe |
| rationing | homefront | north_america |
| manhattan_project | homefront | north_america |
| guadalcanal | naval | pacific |
| italy_campaign | invasion | western_europe |
| tehran_conference | treaty | eastern_europe |
| d_day | invasion | western_europe |
| liberation_paris | liberation | western_europe |
| leyte_gulf | naval | pacific |
| battle_of_bulge | battle | western_europe |
| yalta_conference | treaty | eastern_europe |
| iwo_jima | battle | pacific |
| ve_day | surrender | western_europe |
| atomic_bombs | bombing | pacific |
| vj_day | surrender | pacific |
| rosie_riveter | homefront | north_america |
| japanese_internment | political | north_america |

For each event, add `eventType` and `region` fields. Example for the first event:

```typescript
{
  id: "invasion_poland",
  title: "Invasion of Poland",
  date: "1939-09-01",
  branch: "european",
  importance: "critical",
  eventType: "invasion",
  region: "eastern_europe",
  summary: "Germany invades Poland, triggering declarations of war by Britain and France.",
  sources: [],
  connections: ["britain_declares_war"],
  generatedBy: "preseed",
  enriched: false,
},
```

Apply the same pattern for all 27 events using the mapping table above.

**Step 2: Update preseed script to include new fields**

In `src/scripts/preseed.ts:71-83`, add `eventType` and `region` to the data object being written:

```typescript
data: {
  title: event.title,
  date: event.date,
  endDate: event.endDate || null,
  branch: event.branch,
  importance: event.importance,
  eventType: event.eventType || null,   // NEW
  region: event.region || null,          // NEW
  summary: event.summary,
  sources: [],
  connections: event.connections,
  generatedBy: "preseed",
  enriched: false,
  wikipediaSearchQuery: event.title,
},
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/data/ww2-sample.ts src/scripts/preseed.ts
git commit -m "feat: add eventType and region to all sample events"
```

---

## Task 3: Dark Military/Historical GUI Overhaul — Global Styles & Fonts

**Files:**
- Modify: `src/index.css:1-22`
- Modify: `index.html` (add Google Fonts link)

**Step 1: Add Google Fonts to index.html**

Add this inside `<head>` in `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

**Step 2: Update global CSS**

Replace `src/index.css` with the new dark military theme:

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
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #0d0d12;
  color: #d4cfc4;
}

h1, h2, h3 {
  font-family: "Playfair Display", Georgia, serif;
}

a {
  color: #7B9EC2;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

::selection {
  background: rgba(201, 168, 76, 0.3);
  color: #fff;
}

::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #0d0d12;
}

::-webkit-scrollbar-thumb {
  background: #2a2a3a;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #3a3a4a;
}
```

**Step 3: Verify the app still renders**

Run: `npm run dev`
Open browser. Confirm text renders in Inter, headings in Playfair Display, background is #0d0d12.

**Step 4: Commit**

```bash
git add src/index.css index.html
git commit -m "feat: dark military/historical global styles with Playfair Display"
```

---

## Task 4: Event Page Restyling

**Files:**
- Modify: `src/pages/EventPage.css:1-189`
- Modify: `src/pages/EventPage.tsx:80-118`
- Modify: `src/components/Chat/ChatPanel.css:1-118`

**Step 1: Restyle EventPage.css with military theme**

Replace `src/pages/EventPage.css`:

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

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #666;
}

.breadcrumb a {
  color: #7B9EC2;
}

.breadcrumb .separator {
  color: #444;
}

.source-count {
  color: #666;
  font-size: 13px;
}

.event-title-section {
  margin-bottom: 24px;
}

.importance-star {
  color: #C9A84C;
  font-size: 24px;
}

.event-title-section h1 {
  font-size: 32px;
  font-weight: 700;
  margin: 4px 0 8px;
  color: #d4cfc4;
}

.event-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #666;
  font-size: 14px;
}

.branch-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid;
  border-radius: 12px;
  padding: 2px 10px;
  font-size: 12px;
}

.event-image {
  margin-bottom: 24px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #1a1a2a;
}

.event-image img {
  width: 100%;
  max-height: 400px;
  object-fit: cover;
}

/* Image Gallery */
.image-gallery {
  margin-bottom: 24px;
}

.image-gallery-main {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #1a1a2a;
  margin-bottom: 8px;
}

.image-gallery-main img {
  width: 100%;
  max-height: 400px;
  object-fit: cover;
}

.image-gallery-caption {
  padding: 8px 12px;
  font-size: 13px;
  color: #888;
  background: #151520;
  font-style: italic;
}

.image-gallery-thumbs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.image-gallery-thumb {
  flex-shrink: 0;
  width: 80px;
  height: 60px;
  border-radius: 4px;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s, border-color 0.2s;
}

.image-gallery-thumb.active,
.image-gallery-thumb:hover {
  border-color: #C9A84C;
  opacity: 1;
}

.image-gallery-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-placeholder {
  margin-bottom: 24px;
  padding: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #151520;
  border-radius: 8px;
  border: 1px dashed #2a2a3a;
  color: #444;
}

.image-placeholder svg {
  margin-bottom: 8px;
}

.event-content {
  font-size: 16px;
  line-height: 1.7;
  color: #d4cfc4;
  margin-bottom: 32px;
}

.citation {
  color: #C9A84C;
  font-size: 12px;
  vertical-align: super;
  text-decoration: none;
  font-weight: 600;
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
  background: linear-gradient(90deg, #151520 25%, #1e1e30 50%, #151520 75%);
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
  border-top: 1px solid #1a1a2a;
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
  background: #151520;
  border-radius: 6px;
  border: 1px solid #1e1e30;
  transition: border-color 0.2s;
}

.related-card:hover {
  border-color: #C9A84C;
}

.related-title {
  color: #d4cfc4;
  font-weight: 500;
}

.related-date {
  color: #666;
  font-size: 13px;
}

/* Academic footnote styling for sources */
.event-sources ol {
  list-style: none;
  counter-reset: source-counter;
}

.event-sources li {
  counter-increment: source-counter;
  margin-bottom: 12px;
  padding-left: 28px;
  position: relative;
  font-size: 14px;
}

.event-sources li::before {
  content: "[" counter(source-counter) "]";
  position: absolute;
  left: 0;
  color: #C9A84C;
  font-size: 13px;
  font-weight: 600;
}

.event-sources a {
  color: #7B9EC2;
  text-decoration: none;
}

.event-sources a:hover {
  text-decoration: underline;
}

.source-snippet {
  color: #666;
  font-size: 13px;
  margin-top: 2px;
}
```

**Step 2: Update EventPage.tsx breadcrumb navigation**

Replace the header section in `src/pages/EventPage.tsx:82-89` with breadcrumb navigation:

```tsx
<header className="event-header">
  <nav className="breadcrumb">
    <Link to={`/topic/${topicId}`}>Timeline</Link>
    <span className="separator">&rsaquo;</span>
    {branch && <><span>{branch.name}</span><span className="separator">&rsaquo;</span></>}
    <span>{event.title}</span>
  </nav>
  {event.sources.length > 0 && (
    <span className="source-count">{event.sources.length} sources</span>
  )}
</header>
```

**Step 3: Restyle ChatPanel.css with war room console feel**

Replace `src/components/Chat/ChatPanel.css`:

```css
.chat-panel {
  border-top: 1px solid #1a1a2a;
  padding-top: 24px;
  margin-top: 32px;
}

.chat-title {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: #C9A84C;
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
  border-radius: 4px;
  max-width: 85%;
}

.chat-message-user {
  background: #1a2a3a;
  align-self: flex-end;
  color: #d4cfc4;
  border: 1px solid #2a3a4a;
}

.chat-message-assistant {
  background: #151520;
  align-self: flex-start;
  color: #d4cfc4;
  border: 1px solid #1e1e30;
}

.chat-message-content {
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.chat-typing {
  color: #C9A84C;
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
  color: #C9A84C;
  padding: 4px 8px;
  background: rgba(201, 168, 76, 0.1);
  border-radius: 4px;
  border: 1px solid rgba(201, 168, 76, 0.2);
}

.chat-input-form {
  display: flex;
  gap: 8px;
}

.chat-input {
  flex: 1;
  padding: 10px 14px;
  background: #0d0d12;
  border: 1px solid #2a2a3a;
  border-radius: 4px;
  color: #d4cfc4;
  font-size: 14px;
  font-family: "Consolas", "Fira Code", monospace;
  outline: none;
  transition: border-color 0.2s;
}

.chat-input:focus {
  border-color: #C9A84C;
}

.chat-input::placeholder {
  color: #444;
}

.chat-input:disabled {
  opacity: 0.5;
}

.chat-send {
  padding: 10px 20px;
  background: #C9A84C;
  border: none;
  border-radius: 4px;
  color: #0d0d12;
  font-size: 14px;
  font-weight: 600;
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

**Step 4: Verify the event page renders correctly**

Run: `npm run dev`
Navigate to an event page. Confirm breadcrumb navigation, gold accents, Playfair Display headings, monospace chat input.

**Step 5: Commit**

```bash
git add src/pages/EventPage.css src/pages/EventPage.tsx src/components/Chat/ChatPanel.css
git commit -m "feat: dark military theme for event page and chat panel"
```

---

## Task 5: Event-Type SVG Icon Paths

**Files:**
- Create: `src/components/Timeline/event-icons.ts`

**Step 1: Create the icon path data file**

Create `src/components/Timeline/event-icons.ts` with SVG path data for each event type. Icons are designed to fit inside a circle — path data is normalized to a -6 to 6 coordinate space (12x12 unit box centered on origin).

```typescript
import type { EventType } from "../../types/index.ts";

// SVG path data for event type icons, normalized to -6..6 coordinate space
// These render inside node circles, so they must be small and recognizable
export const EVENT_ICON_PATHS: Record<EventType, string> = {
  // Crossed swords
  battle: "M-4,-4 L4,4 M-3,-4 L-4,-4 L-4,-3 M3,4 L4,4 L4,3 M4,-4 L-4,4 M3,-4 L4,-4 L4,-3 M-3,4 L-4,4 L-4,3",

  // Explosion star burst
  bombing: "M0,-5 L1,-2 L4,-3 L2,-1 L5,0 L2,1 L4,3 L1,2 L0,5 L-1,2 L-4,3 L-2,1 L-5,0 L-2,-1 L-4,-3 L-1,-2 Z",

  // Arrow pointing right into territory
  invasion: "M-4,0 L3,0 M0,-3 L3,0 L0,3 M-4,-2 L-4,2",

  // Ship/anchor
  naval: "M0,-4 L0,-2 M-3,0 Q0,4 3,0 M-4,2 L4,2 M0,-2 Q-2,0 -3,2 M0,-2 Q2,0 3,2",

  // Scroll/pen
  treaty: "M-3,-4 L3,-4 L3,4 L-3,4 Z M-1,-2 L1,-2 M-1,0 L1,0 M-1,2 L1,2",

  // Gavel
  declaration: "M-3,-3 L1,1 M1,-3 L-3,1 M-1,-1 L3,-1 M-2,2 L2,2 M0,2 L0,4",

  // Lowered flag
  surrender: "M-3,-4 L-3,4 M-3,-4 L3,-2 L-3,0",

  // Factory/wrench
  homefront: "M-4,3 L-4,-1 L-2,-3 L-2,-1 L0,-3 L0,-1 L2,-3 L2,-1 L4,-1 L4,3 Z",

  // Capitol/podium
  political: "M-3,3 L-3,0 L0,-3 L3,0 L3,3 M-4,3 L4,3 M-2,0 L-2,3 M2,0 L2,3",

  // Broken chain
  liberation: "M-4,0 Q-4,-3 -1,-3 M-1,-3 L-1,-1 M1,3 L1,1 M1,3 Q4,3 4,0",

  // Running figures
  evacuation: "M-2,-3 A1,1 0 1,1 -2,-1 M-2,-1 L-2,2 M-2,0 L-4,1 M-2,0 L0,1 M-2,2 L-4,4 M-2,2 L0,4",
};

// Stroke-based icons (no fill, just lines) — all icons use stroke rendering
export const ICON_STYLE = {
  stroke: "#fff",
  strokeWidth: 0.8,
  fill: "none",
  opacity: 0.9,
} as const;
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/Timeline/event-icons.ts
git commit -m "feat: SVG icon path data for all 11 event types"
```

---

## Task 6: Smart Label Placement (Collision Detection)

**Files:**
- Modify: `src/components/Timeline/timeline-renderer.ts:155-228`

**Step 1: Implement collision detection and smart label placement**

This replaces the current event node rendering loop (lines 155-228 of `timeline-renderer.ts`). The key changes:
1. Sort events by importance (critical first) for priority placement
2. Track placed label bounding boxes
3. Try below, above, diagonal offsets to avoid overlaps
4. Add semi-transparent background pills to labels

Replace the `// Draw event nodes` section (lines 155-228) with:

```typescript
  // --- Smart Label Placement ---
  interface LabelRect {
    x: number;
    y: number;
    width: number;
    height: number;
  }
  const placedLabels: LabelRect[] = [];

  function labelsOverlap(a: LabelRect, b: LabelRect): boolean {
    return !(a.x + a.width / 2 < b.x - b.width / 2 ||
             a.x - a.width / 2 > b.x + b.width / 2 ||
             a.y + a.height < b.y ||
             a.y > b.y + b.height);
  }

  function findLabelPosition(
    cx: number, cy: number, r: number, textWidth: number
  ): { dx: number; dy: number } {
    const textHeight = 14;
    const offsets = [
      { dx: 0, dy: r + 16 },         // below (default)
      { dx: 0, dy: -(r + 6) },       // above
      { dx: r + 8, dy: 4 },          // right
      { dx: -(r + 8), dy: 4 },       // left
      { dx: r + 6, dy: r + 10 },     // diagonal bottom-right
      { dx: -(r + 6), dy: -(r + 4) },// diagonal top-left
    ];

    for (const offset of offsets) {
      const candidate: LabelRect = {
        x: cx + offset.dx,
        y: cy + offset.dy - textHeight,
        width: textWidth,
        height: textHeight + 4,
      };

      const hasOverlap = placedLabels.some((placed) => labelsOverlap(candidate, placed));
      if (!hasOverlap) {
        placedLabels.push(candidate);
        return offset;
      }
    }

    // All positions overlap — use default below and accept it
    const fallback = offsets[0];
    placedLabels.push({
      x: cx + fallback.dx,
      y: cy + fallback.dy - textHeight,
      width: textWidth,
      height: textHeight + 4,
    });
    return fallback;
  }

  // Sort: critical first so they get priority placement
  const importanceOrder = { critical: 0, major: 1, standard: 2, minor: 3 };
  const sortedEvents = [...events].sort((a, b) =>
    importanceOrder[a.importance] - importanceOrder[b.importance]
  );

  // Draw event nodes
  sortedEvents.forEach((event) => {
    const x = xScale(new Date(event.date));
    const y = laneY.get(event.branch)!;
    const r = NODE_SIZES[event.importance];
    const color = colorMap.get(event.branch) || "#888";

    const node = g
      .append("g")
      .attr("class", "event-node")
      .attr("data-importance", event.importance)
      .attr("transform", `translate(${x}, ${y})`)
      .style("cursor", "pointer")
      .style("display", event.importance === "minor" || event.importance === "standard" ? "none" : "block");

    // Drop shadow filter (defined once, reused)
    if (!g.select("#drop-shadow").node()) {
      const defs = g.append("defs");
      const filter = defs.append("filter").attr("id", "drop-shadow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
      filter.append("feDropShadow").attr("dx", 0).attr("dy", 1).attr("stdDeviation", 2).attr("flood-color", "#000").attr("flood-opacity", 0.5);
    }

    // Glow for critical events
    if (event.importance === "critical") {
      node.append("circle").attr("r", r + 4).attr("fill", color).attr("opacity", 0.2);
    }

    // Main circle with drop shadow
    node.append("circle")
      .attr("r", r)
      .attr("fill", color)
      .attr("stroke", "#fff")
      .attr("stroke-width", event.importance === "critical" ? 2 : 1)
      .style("filter", "url(#drop-shadow)");

    // Event-type icon inside circle (if eventType and circle is big enough)
    if (event.eventType && r >= 7) {
      const iconScale = r / 8;
      node.append("path")
        .attr("d", EVENT_ICON_PATHS[event.eventType])
        .attr("transform", `scale(${iconScale})`)
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.8 / iconScale)
        .attr("fill", "none")
        .attr("opacity", 0.9)
        .attr("pointer-events", "none");
    }

    // Star for critical events
    if (event.importance === "critical") {
      node.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "-20")
        .attr("fill", "#C9A84C")
        .style("font-size", "14px")
        .text("\u2605");
    }

    // Estimate text width (rough: 6px per char at 10px font, 7px at 12px)
    const fontSize = event.importance === "critical" ? 12 : 10;
    const charWidth = event.importance === "critical" ? 7 : 6;
    const estTextWidth = event.title.length * charWidth;

    // Smart label placement
    const labelPos = findLabelPosition(x, y, r, estTextWidth);

    // Background pill for label
    const pillPadX = 4;
    const pillPadY = 2;
    node.append("rect")
      .attr("x", labelPos.dx - estTextWidth / 2 - pillPadX)
      .attr("y", labelPos.dy - fontSize + pillPadY)
      .attr("width", estTextWidth + pillPadX * 2)
      .attr("height", fontSize + pillPadY * 2)
      .attr("rx", 3)
      .attr("fill", "#0d0d12")
      .attr("opacity", 0.75)
      .attr("pointer-events", "none");

    // Label text
    const textAnchor = labelPos.dx > 0 && Math.abs(labelPos.dx) > r
      ? "start"
      : labelPos.dx < 0 && Math.abs(labelPos.dx) > r
        ? "end"
        : "middle";

    node.append("text")
      .attr("text-anchor", textAnchor)
      .attr("dx", labelPos.dx)
      .attr("dy", labelPos.dy)
      .attr("fill", "#d4cfc4")
      .style("font-size", `${fontSize}px`)
      .style("font-weight", event.importance === "critical" ? "bold" : "normal")
      .attr("pointer-events", "none")
      .text(event.title);

    // Interactions (keep same as before)
    node
      .on("mouseover", (mouseEvent: MouseEvent) => {
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
      .on("mouseout", (mouseEvent: MouseEvent) => {
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
```

Also add this import at the top of `timeline-renderer.ts`:

```typescript
import { EVENT_ICON_PATHS } from "./event-icons.ts";
```

**Step 2: Update connection lines to use bezier curves**

Replace the cross-branch connections section (lines 115-137) with bezier curves:

```typescript
  // Draw cross-branch connections (curved bezier paths)
  events.forEach((event) => {
    event.connections.forEach((connId) => {
      const target = events.find((e) => e.id === connId);
      if (!target) return;
      const x1 = xScale(new Date(event.date));
      const y1 = laneY.get(event.branch)!;
      const x2 = xScale(new Date(target.date));
      const y2 = laneY.get(target.branch)!;

      if (event.branch !== target.branch) {
        const midX = (x1 + x2) / 2;
        g.append("path")
          .attr("d", `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`)
          .attr("stroke", "#444")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "6,3")
          .attr("fill", "none")
          .attr("opacity", 0.3);
      }
    });
  });
```

**Step 3: Update lane backgrounds for the new theme**

Replace the lane backgrounds section (lines 80-100) with dashed dividers and parchment grain:

```typescript
  // Draw lane backgrounds
  branches.forEach((branch, i) => {
    const y = laneY.get(branch.id)!;
    g.append("rect")
      .attr("x", 0)
      .attr("y", y - LANE_HEIGHT / 2)
      .attr("width", width * 3)
      .attr("height", LANE_HEIGHT)
      .attr("fill", branch.color)
      .attr("opacity", 0.04);

    // Dashed lane divider
    if (i > 0) {
      const dividerY = y - LANE_HEIGHT / 2 - LANE_PADDING / 2;
      g.append("line")
        .attr("x1", MARGIN.left)
        .attr("x2", width * 3)
        .attr("y1", dividerY)
        .attr("y2", dividerY)
        .attr("stroke", "#2a2a3a")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "8,4");
    }

    // Lane center line
    g.append("line")
      .attr("x1", MARGIN.left)
      .attr("x2", width * 3)
      .attr("y1", y)
      .attr("y2", y)
      .attr("stroke", branch.color)
      .attr("stroke-opacity", 0.15)
      .attr("stroke-width", 1);
  });
```

**Step 4: Update SVG background and time axis colors**

Change the SVG background (line 54) from `#0a0a0f` to `#0d0d12`.

Change the time axis text color (line 112) from `#888` to `#666`.

Update the tooltip background (line 144) from `#1a1a2e` to `#151520` and border from `#333` to `#2a2a3a`.

Update the lane header background gradient (line 240) from `#0a0a0f` to `#0d0d12`.

**Step 5: Verify the timeline renders with label placement, icons, and new theme**

Run: `npm run dev`
Open the timeline. Confirm:
- Labels don't overlap (or overlap less)
- Labels have dark background pills
- Connection lines are curved bezier paths
- Lane dividers are dashed
- Critical event stars are gold (#C9A84C)
- Event type icons visible inside larger nodes
- Background is #0d0d12

**Step 6: Commit**

```bash
git add src/components/Timeline/timeline-renderer.ts src/components/Timeline/event-icons.ts
git commit -m "feat: smart label placement, event icons, bezier curves, theme update"
```

---

## Task 7: Geographic Mini-Map Component

**Files:**
- Create: `src/components/Timeline/MiniMap.tsx`
- Create: `src/components/Timeline/MiniMap.css`
- Modify: `src/components/Timeline/Timeline.tsx`

**Step 1: Create the MiniMap CSS**

Create `src/components/Timeline/MiniMap.css`:

```css
.mini-map {
  position: absolute;
  bottom: 16px;
  right: 16px;
  width: 300px;
  height: 150px;
  background: rgba(13, 13, 18, 0.85);
  border: 1px solid #2a2a3a;
  border-radius: 8px;
  overflow: hidden;
  pointer-events: auto;
  z-index: 5;
}

.mini-map-title {
  position: absolute;
  top: 4px;
  left: 8px;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #555;
  font-family: "Inter", sans-serif;
}

.mini-map svg {
  width: 100%;
  height: 100%;
}

.mini-map-region {
  fill: #1a1a2a;
  stroke: #2a2a3a;
  stroke-width: 0.5;
  transition: fill 0.3s, opacity 0.3s;
  cursor: pointer;
}

.mini-map-region:hover {
  stroke: #C9A84C;
  stroke-width: 1;
}

.mini-map-region.active {
  opacity: 0.8;
}

.mini-map-legend {
  position: absolute;
  bottom: 4px;
  left: 8px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.mini-map-legend-item {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 8px;
  color: #666;
}

.mini-map-legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
```

**Step 2: Create the MiniMap component**

Create `src/components/Timeline/MiniMap.tsx`:

```tsx
import { useMemo } from "react";
import type { TimelineEvent, Branch, Region } from "../../types/index.ts";
import "./MiniMap.css";

interface MiniMapProps {
  events: TimelineEvent[];
  branches: Branch[];
  onRegionHover?: (region: Region | null) => void;
}

// Simplified world region polygons (SVG paths in a 300x150 viewBox)
const REGION_PATHS: Record<Region, string> = {
  north_america:
    "M20,20 L90,15 L100,40 L85,70 L60,80 L30,65 L15,45 Z",
  western_europe:
    "M130,20 L155,18 L160,35 L155,55 L140,60 L128,45 Z",
  eastern_europe:
    "M160,15 L195,12 L200,45 L190,65 L160,60 L158,35 Z",
  north_africa:
    "M125,65 L195,60 L200,80 L180,90 L130,88 L120,75 Z",
  atlantic:
    "M95,30 L125,25 L130,60 L120,70 L95,65 Z",
  east_asia:
    "M220,25 L260,20 L270,50 L250,65 L220,55 Z",
  southeast_asia:
    "M240,65 L275,55 L285,80 L270,95 L245,90 Z",
  pacific:
    "M260,70 L290,60 L295,100 L275,120 L250,110 L245,85 Z",
};

export default function MiniMap({ events, branches, onRegionHover }: MiniMapProps) {
  // Which regions are active and what colors they should glow
  const regionColors = useMemo(() => {
    const colorMap = new Map<string, string>();
    branches.forEach((b) => colorMap.set(b.id, b.color));

    const regionMap = new Map<Region, Set<string>>();
    events.forEach((event) => {
      if (!event.region) return;
      if (!regionMap.has(event.region)) {
        regionMap.set(event.region, new Set());
      }
      const color = colorMap.get(event.branch);
      if (color) regionMap.get(event.region)!.add(color);
    });

    // For each region, blend colors (just pick the most common branch color)
    const result = new Map<Region, string>();
    regionMap.forEach((colors, region) => {
      // Pick first color for simplicity — could blend later
      result.set(region, [...colors][0]);
    });
    return result;
  }, [events, branches]);

  const activeRegions = [...regionColors.keys()];

  return (
    <div className="mini-map">
      <span className="mini-map-title">Theater Map</span>
      <svg viewBox="0 0 300 150">
        {(Object.entries(REGION_PATHS) as [Region, string][]).map(([region, path]) => {
          const color = regionColors.get(region);
          return (
            <path
              key={region}
              d={path}
              className={`mini-map-region ${color ? "active" : ""}`}
              fill={color || "#1a1a2a"}
              fillOpacity={color ? 0.4 : 1}
              onMouseEnter={() => onRegionHover?.(region)}
              onMouseLeave={() => onRegionHover?.(null)}
            />
          );
        })}
      </svg>
      {activeRegions.length > 0 && (
        <div className="mini-map-legend">
          {activeRegions.map((region) => (
            <span key={region} className="mini-map-legend-item">
              <span
                className="mini-map-legend-dot"
                style={{ background: regionColors.get(region) }}
              />
              {region.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Integrate MiniMap into Timeline.tsx**

Read `src/components/Timeline/Timeline.tsx` and add MiniMap. The Timeline component needs to:
1. Import MiniMap
2. Render it alongside the timeline container
3. Wrap both in a relatively-positioned container

Modify `src/components/Timeline/Timeline.tsx` to import and render MiniMap:

```tsx
import { useRef, useEffect } from "react";
import type { TimelineEvent, Branch, Region } from "../../types/index.ts";
import { renderTimeline } from "./timeline-renderer.ts";
import MiniMap from "./MiniMap.tsx";

interface TimelineProps {
  events: TimelineEvent[];
  branches: Branch[];
  onEventClick: (eventId: string) => void;
}

export default function Timeline({ events, branches, onEventClick }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || events.length === 0 || !branches || branches.length === 0) return;

    const { svg } = renderTimeline({
      container: containerRef.current,
      events,
      branches,
      onEventClick,
    });

    const handleResize = () => {
      if (!containerRef.current) return;
      renderTimeline({ container: containerRef.current, events, branches, onEventClick });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [events, branches, onEventClick]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }} />
      <MiniMap events={events} branches={branches} />
    </div>
  );
}
```

**Step 4: Verify mini-map renders**

Run: `npm run dev`
Open the timeline. Confirm:
- Mini-map appears in bottom-right corner
- Regions with events glow with branch colors
- Hovering regions works (no crash)
- Legend shows active regions

**Step 5: Commit**

```bash
git add src/components/Timeline/MiniMap.tsx src/components/Timeline/MiniMap.css src/components/Timeline/Timeline.tsx
git commit -m "feat: geographic mini-map with region color coding"
```

---

## Task 8: Multiple Images on Event Pages

**Files:**
- Create: `src/components/EventDetail/ImageGallery.tsx`
- Modify: `src/components/EventDetail/EventImage.tsx:1-14`
- Modify: `src/pages/EventPage.tsx:105`

**Step 1: Create ImageGallery component**

Create `src/components/EventDetail/ImageGallery.tsx`:

```tsx
import { useState } from "react";
import type { EventImage } from "../../types/index.ts";

interface ImageGalleryProps {
  images: EventImage[];
  alt: string;
}

export default function ImageGallery({ images, alt }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) return null;

  const active = images[activeIndex];

  return (
    <div className="image-gallery">
      <div className="image-gallery-main">
        <img src={active.url} alt={active.caption || alt} />
        {active.caption && (
          <div className="image-gallery-caption">
            {active.caption}
            {active.source && <span> — {active.source}</span>}
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="image-gallery-thumbs">
          {images.map((img, i) => (
            <div
              key={i}
              className={`image-gallery-thumb ${i === activeIndex ? "active" : ""}`}
              onClick={() => setActiveIndex(i)}
            >
              <img src={img.url} alt={img.caption || `${alt} ${i + 1}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Update EventImage to use gallery when multiple images available**

Replace `src/components/EventDetail/EventImage.tsx`:

```tsx
import type { EventImage as EventImageType } from "../../types/index.ts";
import ImageGallery from "./ImageGallery.tsx";

interface EventImageProps {
  url?: string;
  alt: string;
  images?: EventImageType[];
}

export default function EventImage({ url, alt, images }: EventImageProps) {
  // If we have a gallery of images, show the gallery
  if (images && images.length > 0) {
    return <ImageGallery images={images} alt={alt} />;
  }

  // Single image fallback (from wikipediaImageUrl)
  if (url) {
    return (
      <div className="event-image">
        <img src={url} alt={alt} />
      </div>
    );
  }

  return null;
}
```

**Step 3: Pass images prop from EventPage**

In `src/pages/EventPage.tsx`, update the EventImage usage (line 105):

```tsx
<EventImage url={event.wikipediaImageUrl} alt={event.title} images={event.images} />
```

**Step 4: Verify TypeScript compiles and event pages render**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npm run dev`
Navigate to an event page. With no `images` array, it should still show `wikipediaImageUrl` (or nothing) as before.

**Step 5: Commit**

```bash
git add src/components/EventDetail/ImageGallery.tsx src/components/EventDetail/EventImage.tsx src/pages/EventPage.tsx
git commit -m "feat: image gallery component with thumbnail strip"
```

---

## Task 9: Timeline Header & Axis Polish

**Files:**
- Modify: `src/components/Timeline/timeline-renderer.ts` (header section, lines 230-263)

**Step 1: Polish lane headers with new theme**

Update the lane header section (lines 230-263) of `timeline-renderer.ts`. Change colors and add accent bar:

```typescript
  // Draw lane headers
  const headerSvg = d3
    .select(container)
    .append("svg")
    .attr("width", MARGIN.left)
    .attr("height", height)
    .style("position", "absolute")
    .style("top", "0")
    .style("left", "0")
    .style("pointer-events", "none")
    .style("background", "linear-gradient(to right, #0d0d12 80%, transparent)");

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
      .attr("fill", "#d4cfc4")
      .style("font-size", "13px")
      .style("font-weight", "600")
      .style("font-family", "'Playfair Display', Georgia, serif")
      .text(branch.name);
  });
```

Also update the time axis section to add faint year grid lines:

```typescript
  // Draw time axis
  const xAxis = d3
    .axisTop(xScale)
    .ticks(10)
    .tickFormat((d) => d3.timeFormat("%b %Y")(d as Date));

  const axisGroup = g.append("g")
    .attr("transform", `translate(0, ${MARGIN.top - 10})`)
    .call(xAxis)
    .attr("color", "#444");

  axisGroup.selectAll("text")
    .attr("fill", "#666")
    .style("font-size", "11px");

  // Faint vertical grid at each year
  const yearTicks = xScale.ticks(d3.timeYear.every(1)!);
  yearTicks.forEach((tick) => {
    g.append("line")
      .attr("x1", xScale(tick))
      .attr("x2", xScale(tick))
      .attr("y1", MARGIN.top)
      .attr("y2", height - MARGIN.bottom)
      .attr("stroke", "#1a1a2a")
      .attr("stroke-width", 1);
  });
```

**Step 2: Verify**

Run: `npm run dev`
Confirm lane headers use Playfair Display, text is warm off-white, year grid lines visible.

**Step 3: Commit**

```bash
git add src/components/Timeline/timeline-renderer.ts
git commit -m "feat: polished lane headers and year grid lines"
```

---

## Task 10: Final Integration & Visual QA

**Files:**
- All modified files from previous tasks

**Step 1: Full build check**

Run: `npx tsc --noEmit`
Expected: No errors

Run: `npm run build`
Expected: Build succeeds

**Step 2: Visual QA checklist**

Run: `npm run dev` and verify:

- [ ] Timeline background is #0d0d12
- [ ] Lane headers in Playfair Display serif
- [ ] Lane dividers are dashed lines
- [ ] Connection lines are bezier curves
- [ ] Event node labels have background pills
- [ ] Labels don't overlap (or overlap much less)
- [ ] Event-type icons visible in critical/major nodes
- [ ] Critical event stars are gold (#C9A84C)
- [ ] Year grid lines visible
- [ ] Mini-map in bottom-right corner
- [ ] Mini-map regions glow with branch colors
- [ ] Event page has breadcrumb navigation
- [ ] Event page headings in Playfair Display
- [ ] Citation links are gold
- [ ] Chat panel has monospace input, gold send button
- [ ] Scrollbars styled dark

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: GUI improvements phase 2 complete"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Extend types with eventType, region, images | `src/types/index.ts` |
| 2 | Add eventType/region to sample data | `src/data/ww2-sample.ts`, `src/scripts/preseed.ts` |
| 3 | Global styles & fonts overhaul | `src/index.css`, `index.html` |
| 4 | Event page & chat restyling | `src/pages/EventPage.css`, `EventPage.tsx`, `ChatPanel.css` |
| 5 | Event-type SVG icon paths | `src/components/Timeline/event-icons.ts` |
| 6 | Smart labels, icons, bezier curves in renderer | `src/components/Timeline/timeline-renderer.ts` |
| 7 | Geographic mini-map | `MiniMap.tsx`, `MiniMap.css`, `Timeline.tsx` |
| 8 | Multiple images on event pages | `ImageGallery.tsx`, `EventImage.tsx`, `EventPage.tsx` |
| 9 | Timeline header & axis polish | `timeline-renderer.ts` |
| 10 | Final integration & QA | All files |
