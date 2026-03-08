# GUI Improvements Design — Phase 2

## Overview

Five areas of improvement to the history explorer:

1. Fix overlapping text on timeline
2. Event-type icons inside nodes
3. Mini-map with geographic color coding
4. Multiple images on event pages
5. Dark military/historical GUI overhaul

## 1. Smart Label Placement

Collision detection pass after placing nodes. For each event label, check overlap against previously placed labels. Resolution order: below node, above node, diagonal offset. Events within ~5 days on the same branch alternate above/below automatically. Critical events get priority placement. All labels get a semi-transparent dark background pill for readability.

## 2. Event-Type Icons

New `eventType` field on TimelineEvent. SVG icons rendered inside node circles.

| Type | Icon | Examples |
|------|------|----------|
| battle | Crossed swords | D-Day, Midway, Stalingrad |
| bombing | Explosion | Atomic Bombings, Battle of Britain |
| invasion | Arrow into territory | Poland, Barbarossa |
| naval | Ship/anchor | Leyte Gulf, Guadalcanal |
| treaty | Scroll/pen | Yalta, Tehran |
| declaration | Gavel | US/Britain Declares War |
| surrender | Flag | V-E Day, V-J Day |
| homefront | Factory/wrench | Manhattan Project, Rationing |
| political | Capitol/podium | Lend-Lease, Japanese Internment |
| liberation | Broken chain | Liberation of Paris |
| evacuation | Running figures | Dunkirk |

Node size still driven by importance. Icon drawn inside the circle. Critical events keep the star above plus icon inside.

## 3. Mini-Map

Small world map (300x150px) fixed in bottom-right corner of timeline view. Semi-transparent.

- New `region` field on TimelineEvent: western_europe, eastern_europe, pacific, north_africa, north_america, east_asia, southeast_asia
- Static SVG with ~8 simplified region polygons (no mapping library)
- Visible events on timeline determine which regions glow with branch colors
- Hover a region on mini-map highlights matching events on timeline
- Small legend shows active regions

## 4. Event Page — Multiple Images

- New `images` array field: `{ url, caption, source }[]`
- First image displayed large, additional as horizontal scrollable thumbnails
- Click thumbnail to swap to main
- Wikipedia API fetches all article images during enrichment (not just thumbnail)
- Fallback: muted placeholder with event type icon if no images

## 5. Dark Military/Historical GUI

### Typography
- Headings: Playfair Display (serif, Google Fonts)
- Body: Inter or system sans-serif

### Color Palette
- Background: #0d0d12
- Cards/panels: #151520 with subtle noise texture
- Lanes: branch colors at low opacity with faint parchment grain
- Accent gold: #C9A84C (critical events, stars, UI accents)
- Text: #d4cfc4 (warm off-white)
- Links: #7B9EC2 (muted steel blue)

### Timeline Visual
- Lane dividers: subtle dashed lines
- Node circles: slight drop shadow
- Cross-branch connections: curved bezier paths (not straight dotted lines)
- Time axis: subtle tick marks, faint vertical grid at each year

### Event Page
- Back button as breadcrumb: Timeline > European Theater > D-Day
- Branch badge includes event type icon
- Sources styled as academic footnotes
- Chat panel: "war room console" feel, monospace input field
