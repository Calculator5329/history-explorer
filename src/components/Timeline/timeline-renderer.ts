import * as d3 from "d3";
import type { TimelineEvent, Branch } from "../../types/index.ts";
import { EVENT_ICON_PATHS } from "./event-icons.ts";

interface RenderOptions {
  container: HTMLDivElement;
  events: TimelineEvent[];
  branches: Branch[];
  onEventClick: (eventId: string) => void;
}

const LANE_HEIGHT = 100;
const LANE_PADDING = 20;
const NODE_SIZES: Record<TimelineEvent["importance"], number> = {
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
    .style("background", "#0d0d12");

  // Main group for zoom/pan
  const g = svg.append("g");

  // Zoom behavior
  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.5, 10])
    .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
      g.attr("transform", event.transform.toString());
      const k = event.transform.k;

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
      { dx: 0, dy: r + 16 },
      { dx: 0, dy: -(r + 6) },
      { dx: r + 8, dy: 4 },
      { dx: -(r + 8), dy: 4 },
      { dx: r + 6, dy: r + 10 },
      { dx: -(r + 6), dy: -(r + 4) },
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
      .text(branch.name);
  });

  return { svg, zoom };
}
