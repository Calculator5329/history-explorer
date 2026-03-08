import * as d3 from "d3";
import type { TimelineEvent, Branch } from "../../types/index.ts";
import { EVENT_ICON_PATHS } from "./event-icons.ts";

interface RenderOptions {
  container: HTMLDivElement;
  events: TimelineEvent[];
  branches: Branch[];
  onEventClick: (eventId: string) => void;
}

const BASE_LANE_HEIGHT = 120;
const LANE_PADDING = 30;
const SLOT_GAP_PX = 20;
const CLUSTER_X_GAP_PX = 120;
const NODE_SIZES: Record<TimelineEvent["importance"], number> = {
  critical: 14,
  major: 10,
  standard: 7,
  minor: 4,
};
const MARGIN = { top: 60, right: 40, bottom: 40, left: 180 };

interface LaneMetric {
  center: number;
  top: number;
  bottom: number;
  height: number;
}

function buildSlotOrder(depth: number): number[] {
  const order: number[] = [0];
  for (let i = 1; i <= depth; i++) {
    order.push(-i, i);
  }
  return order;
}

export function renderTimeline({ container, events, branches, onEventClick }: RenderOptions) {
  // Clear previous render
  d3.select(container).selectAll("*").remove();

  const width = container.clientWidth;
  if (events.length === 0 || branches.length === 0) return null;

  // Time scale
  const dates = events.map((e) => new Date(e.date));
  const timeExtent = d3.extent(dates) as [Date, Date];
  // Add padding to time range
  const timePad = (timeExtent[1].getTime() - timeExtent[0].getTime()) * 0.05;
  const xScale = d3
    .scaleTime()
    .domain([new Date(timeExtent[0].getTime() - timePad), new Date(timeExtent[1].getTime() + timePad)])
    .range([MARGIN.left, width - MARGIN.right]);

  // Assign each event to a vertical slot within its branch based on temporal proximity.
  const eventSlotMap = new Map<string, number>();
  const eventsByBranch = d3.group(events, (e) => e.branch);
  const slotOrder = buildSlotOrder(8);
  const branchSlotRange = new Map<string, { min: number; max: number }>();
  const branchPeakActive = new Map<string, number>();

  eventsByBranch.forEach((branchEvents, branchId) => {
    const sorted = [...branchEvents].sort((a, b) => {
      const dx = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dx !== 0) return dx;
      return a.title.localeCompare(b.title);
    });

    const active: Array<{ x: number; slot: number }> = [];
    let minSlot = 0;
    let maxSlot = 0;
    let peakActive = 0;

    for (const ev of sorted) {
      const x = xScale(new Date(ev.date));
      for (let i = active.length - 1; i >= 0; i--) {
        if (x - active[i].x > CLUSTER_X_GAP_PX) active.splice(i, 1);
      }

      const used = new Set(active.map((a) => a.slot));
      let slot = slotOrder.find((s) => !used.has(s));
      if (slot === undefined) {
        const overflowDepth = Math.ceil((active.length + 1) / 2);
        slot = overflowDepth * (active.length % 2 === 0 ? -1 : 1);
      }

      eventSlotMap.set(ev.id, slot);
      active.push({ x, slot });
      peakActive = Math.max(peakActive, active.length);

      minSlot = Math.min(minSlot, slot);
      maxSlot = Math.max(maxSlot, slot);
    }

    branchSlotRange.set(branchId, { min: minSlot, max: maxSlot });
    branchPeakActive.set(branchId, peakActive);
  });

  // Build adaptive lane metrics.
  const laneMetrics = new Map<string, LaneMetric>();
  let laneCursor = MARGIN.top;
  branches.forEach((branch) => {
    const slotRange = branchSlotRange.get(branch.id) ?? { min: 0, max: 0 };
    const slotSpan = slotRange.max - slotRange.min;
    const peakActive = branchPeakActive.get(branch.id) ?? 1;
    const adaptiveHeight = Math.max(
      BASE_LANE_HEIGHT,
      94 + slotSpan * SLOT_GAP_PX * 1.2 + Math.max(0, peakActive - 1) * 6
    );
    const laneHeight = Math.min(250, adaptiveHeight);
    const top = laneCursor;
    const bottom = laneCursor + laneHeight;
    const center = (top + bottom) / 2;
    laneMetrics.set(branch.id, { top, bottom, center, height: laneHeight });
    laneCursor = bottom + LANE_PADDING;
  });
  const height = laneCursor - LANE_PADDING + MARGIN.bottom;

  // Lane y positions and final event y map.
  const laneY = new Map<string, number>();
  const eventYMap = new Map<string, number>();
  branches.forEach((branch) => {
    const lane = laneMetrics.get(branch.id)!;
    laneY.set(branch.id, lane.center);
  });
  events.forEach((event) => {
    const laneCenter = laneY.get(event.branch);
    const slot = eventSlotMap.get(event.id) ?? 0;
    if (laneCenter !== undefined) {
      eventYMap.set(event.id, laneCenter + slot * SLOT_GAP_PX);
    }
  });

  // Second pass: resolve local collisions by pushing nearby events apart vertically.
  eventsByBranch.forEach((branchEvents, branchId) => {
    const lane = laneMetrics.get(branchId);
    if (!lane || branchEvents.length < 2) return;

    const sorted = [...branchEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const xById = new Map(sorted.map((ev) => [ev.id, xScale(new Date(ev.date))]));
    const minY = lane.top + 14;
    const maxY = lane.bottom - 14;

    for (let pass = 0; pass < 7; pass++) {
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const a = sorted[i];
          const b = sorted[j];
          const xA = xById.get(a.id)!;
          const xB = xById.get(b.id)!;
          if (xB - xA > CLUSTER_X_GAP_PX * 1.45) break;

          const yA = eventYMap.get(a.id) ?? lane.center;
          const yB = eventYMap.get(b.id) ?? lane.center;
          const minDistance = NODE_SIZES[a.importance] + NODE_SIZES[b.importance] + 16;
          const delta = yA - yB;
          const absDelta = Math.abs(delta);

          if (absDelta >= minDistance) continue;

          const push = (minDistance - absDelta) * 0.52;
          const dir = delta === 0 ? (i % 2 === 0 ? -1 : 1) : Math.sign(delta);
          const nextYA = Math.min(maxY, Math.max(minY, yA + dir * push));
          const nextYB = Math.min(maxY, Math.max(minY, yB - dir * push));
          eventYMap.set(a.id, nextYA);
          eventYMap.set(b.id, nextYB);
        }
      }
    }
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
    .style("background", "#0d0d12");

  // Main group for zoom/pan
  const g = svg.append("g");

  // Header group ref - will be set later when header SVG is created
  let headerGroupRef: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;

  // Zoom behavior
  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.5, 10])
    .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
      g.attr("transform", event.transform.toString());
      const { y: ty, k } = event.transform;

      // Sync header labels with vertical pan/zoom
      if (headerGroupRef) {
        headerGroupRef.attr("transform", `translate(0, ${ty}) scale(1, ${k})`);
      }

      // Show/hide events based on zoom level
      g.selectAll(".event-node").each(function () {
        const el = d3.select(this);
        const importance = el.attr("data-importance");
        if (importance === "minor") {
          el.style("display", k >= 3 ? "block" : "none");
        } else if (importance === "standard") {
          el.style("display", k >= 1.5 ? "block" : "none");
        }
      });
    });
  svg.call(zoom);

  // Draw lane dividers and center lines
  branches.forEach((branch, i) => {
    const lane = laneMetrics.get(branch.id)!;

    // Dashed lane divider
    if (i > 0) {
      const prevBranch = branches[i - 1];
      const prevLane = laneMetrics.get(prevBranch.id)!;
      const dividerY = (prevLane.bottom + lane.top) / 2;
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
      .attr("y1", lane.center)
      .attr("y2", lane.center)
      .attr("stroke", branch.color)
      .attr("stroke-opacity", 0.16)
      .attr("stroke-width", 1);
  });

  // Draw connected highlight bands around same-branch node clusters.
  branches.forEach((branch) => {
    const lane = laneMetrics.get(branch.id)!;
    const branchEvents = (eventsByBranch.get(branch.id) ?? [])
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (branchEvents.length === 0) return;

    const clusters: TimelineEvent[][] = [];
    branchEvents.forEach((event) => {
      const x = xScale(new Date(event.date));
      const cluster = clusters[clusters.length - 1];
      if (!cluster) {
        clusters.push([event]);
        return;
      }
      const lastEvent = cluster[cluster.length - 1];
      const lastX = xScale(new Date(lastEvent.date));
      if (x - lastX <= CLUSTER_X_GAP_PX * 1.9) {
        cluster.push(event);
      } else {
        clusters.push([event]);
      }
    });

    clusters.forEach((cluster) => {
      const points = cluster.map((event) => ({
        x: xScale(new Date(event.date)),
        y: eventYMap.get(event.id) ?? lane.center,
      }));

      const xGaps: number[] = [];
      for (let i = 1; i < points.length; i++) {
        xGaps.push(points[i].x - points[i - 1].x);
      }
      const avgGap = xGaps.length > 0 ? d3.mean(xGaps)! : CLUSTER_X_GAP_PX;
      const densityFactor = Math.max(0.95, Math.min(1.45, 1.3 - avgGap / 420));
      const baseWidth = Math.max(24, Math.min(52, lane.height * 0.3));
      const bandWidth = baseWidth * densityFactor;

      if (points.length === 1) {
        g.append("circle")
          .attr("cx", points[0].x)
          .attr("cy", points[0].y)
                    .attr("r", bandWidth * 0.82)
          .attr("fill", branch.color)
          .attr("opacity", 0.1);
        return;
      }

      const line = d3
        .line<{ x: number; y: number }>()
        .x((d) => d.x)
        .y((d) => d.y)
        .curve(d3.curveCatmullRom.alpha(0.6));

      // Wide glow layer
      g.append("path")
        .attr("d", line(points))
        .attr("fill", "none")
        .attr("stroke", branch.color)
                .attr("stroke-width", bandWidth * 1.75)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("opacity", 0.1);

      // Core highlight ribbon
      g.append("path")
        .attr("d", line(points))
        .attr("fill", "none")
        .attr("stroke", branch.color)
                .attr("stroke-width", bandWidth * 1.0)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("opacity", 0.18);
    });

    // Soft bridge between nearby clusters so highlights feel continuous.
    for (let i = 1; i < clusters.length; i++) {
      const prev = clusters[i - 1];
      const next = clusters[i];
      const prevLast = prev[prev.length - 1];
      const nextFirst = next[0];
      const x1 = xScale(new Date(prevLast.date));
      const x2 = xScale(new Date(nextFirst.date));
      const gap = x2 - x1;
      if (gap > CLUSTER_X_GAP_PX * 3.2) continue;

      const y1 = eventYMap.get(prevLast.id) ?? lane.center;
      const y2 = eventYMap.get(nextFirst.id) ?? lane.center;
      const midX = (x1 + x2) / 2;

      g.append("path")
        .attr("d", `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`)
        .attr("fill", "none")
        .attr("stroke", branch.color)
                .attr("stroke-width", Math.max(22, lane.height * 0.24))
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("opacity", 0.1);
    }
  });
  // Draw time axis
  const xAxis = d3
    .axisTop(xScale)
    .ticks(10)
    .tickFormat((d) => d3.timeFormat("%b %Y")(d as Date));
  g.append("g")
    .attr("transform", `translate(0, ${MARGIN.top - 10})`)
    .call(xAxis)
    .attr("color", "#666")
    .selectAll("text")
    .attr("fill", "#888")
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

  // Draw cross-branch connections (curved bezier paths)
  events.forEach((event) => {
    event.connections.forEach((connId) => {
      const target = events.find((e) => e.id === connId);
      if (!target) return;
      const x1 = xScale(new Date(event.date));
      const y1 = eventYMap.get(event.id) ?? laneY.get(event.branch)!;
      const x2 = xScale(new Date(target.date));
      const y2 = eventYMap.get(target.id) ?? laneY.get(target.branch)!;

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

  // Tooltip div
  const tooltip = d3
    .select(container)
    .append("div")
    .style("position", "absolute")
    .style("background", "#151520")
    .style("border", "1px solid #2a2a3a")
    .style("border-radius", "6px")
    .style("padding", "8px 12px")
    .style("font-size", "13px")
    .style("color", "#e0e0e0")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("max-width", "250px")
    .style("z-index", "10");

  // --- Smart Label Placement ---
  interface LabelRect {
    x: number;
    y: number;
    width: number;
    height: number;
  }
  const lanePlacedLabels = new Map<string, LabelRect[]>();

  function labelsOverlap(a: LabelRect, b: LabelRect): boolean {
    return !(a.x + a.width / 2 < b.x - b.width / 2 ||
             a.x - a.width / 2 > b.x + b.width / 2 ||
             a.y + a.height < b.y ||
             a.y > b.y + b.height);
  }

  function findLabelPosition(
    branchId: string,
    cx: number,
    cy: number,
    r: number,
    textWidth: number
  ): { dx: number; dy: number } {
    const textHeight = 14;
    const laneLabels = lanePlacedLabels.get(branchId) || [];
    const nearby = laneLabels.filter(
      (rect) => Math.abs(rect.x - cx) < (rect.width + textWidth) / 2 + 24
    ).length;

    const offsets: Array<{ dx: number; dy: number }> = [];
    for (let i = 0; i < 8; i++) {
      const rank = nearby + i;
      const direction = rank % 2 === 0 ? 1 : -1;
      const level = Math.floor(rank / 2);
      const dx = level > 2 ? (direction > 0 ? 10 : -10) : 0;
      const dy = direction * (r + 14 + level * 14);
      offsets.push({ dx, dy });
    }

    for (const offset of offsets) {
      const candidate: LabelRect = {
        x: cx + offset.dx,
        y: cy + offset.dy - textHeight,
        width: textWidth,
        height: textHeight + 4,
      };
      const hasOverlap = laneLabels.some((placed) => labelsOverlap(candidate, placed));
      if (!hasOverlap) {
        laneLabels.push(candidate);
        lanePlacedLabels.set(branchId, laneLabels);
        return offset;
      }
    }

    const fallback = { dx: 0, dy: r + 18 + nearby * 12 };
    laneLabels.push({
      x: cx + fallback.dx,
      y: cy + fallback.dy - textHeight,
      width: textWidth,
      height: textHeight + 4,
    });
    lanePlacedLabels.set(branchId, laneLabels);
    return fallback;
  }

  // Sort: critical first so they get priority placement
  const importanceOrder: Record<string, number> = { critical: 0, major: 1, standard: 2, minor: 3 };
  const sortedEvents = [...events].sort((a, b) =>
    importanceOrder[a.importance] - importanceOrder[b.importance]
  );

  // Define drop shadow filter once
  const defs = g.append("defs");
  const filter = defs.append("filter").attr("id", "drop-shadow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
  filter.append("feDropShadow").attr("dx", 0).attr("dy", 1).attr("stdDeviation", 2).attr("flood-color", "#000").attr("flood-opacity", 0.5);

  // Draw event nodes
  sortedEvents.forEach((event) => {
    const x = xScale(new Date(event.date));
    const y = eventYMap.get(event.id) ?? laneY.get(event.branch)!;
    const r = NODE_SIZES[event.importance];
    const color = colorMap.get(event.branch) || "#888";

    const node = g
      .append("g")
      .attr("class", "event-node")
      .attr("data-importance", event.importance)
      .attr("transform", `translate(${x}, ${y})`)
      .style("cursor", "pointer")
      .style("display", event.importance === "minor" || event.importance === "standard" ? "none" : "block");

    // Glow for critical events
    if (event.importance === "critical") {
      node.append("circle").attr("r", r + 4).attr("fill", color).attr("opacity", 0.18);
    }

    // Main circle with drop shadow
    node.append("circle")
      .attr("r", r)
      .attr("fill", color)
      .attr("stroke", "#fff")
      .attr("stroke-width", event.importance === "critical" ? 2 : 1)
      .style("filter", "url(#drop-shadow)");

    // Event-type icon inside circle (if eventType exists and circle big enough)
    if (event.eventType && r >= 7 && EVENT_ICON_PATHS[event.eventType]) {
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

    // Estimate text width
    const fontSize = event.importance === "critical" ? 12 : 10;
    const charWidth = event.importance === "critical" ? 7 : 6;
    const estTextWidth = event.title.length * charWidth;

    // Smart label placement
    const labelPos = findLabelPosition(event.branch, x, y, r, estTextWidth);

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
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dx", labelPos.dx)
      .attr("dy", labelPos.dy)
      .attr("fill", "#d4cfc4")
      .style("font-size", `${fontSize}px`)
      .style("font-weight", event.importance === "critical" ? "bold" : "normal")
      .attr("pointer-events", "none")
      .text(event.title);

    // Interactions
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

  // Draw lane headers (separate SVG that tracks zoom transform vertically)
  const headerSvg = d3
    .select(container)
    .append("svg")
    .attr("width", MARGIN.left)
    .attr("height", height * 10)
    .style("position", "absolute")
    .style("top", "0")
    .style("left", "0")
    .style("pointer-events", "none")
    .style("background", "linear-gradient(to right, #0d0d12 80%, transparent)");

  const headerGroup = headerSvg.append("g");
  headerGroupRef = headerGroup;

  branches.forEach((branch) => {
    const y = laneY.get(branch.id)!;

    headerGroup
      .append("rect")
      .attr("x", 10)
      .attr("y", y - 12)
      .attr("width", 4)
      .attr("height", 24)
      .attr("rx", 2)
      .attr("fill", branch.color);

    headerGroup
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

  return { svg, zoom };
}






