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
    .style("background", "#0a0a0f");

  // Main group for zoom/pan
  const g = svg.append("g");

  // Zoom behavior
  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.5, 10])
    .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
      g.attr("transform", event.transform.toString());
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
