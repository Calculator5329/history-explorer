import { useRef, useEffect, useMemo } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import worldData from "world-atlas/countries-110m.json";
import type { Topology } from "topojson-specification";
import type { TimelineEvent, Branch, Region } from "../../types/index.ts";
import "./MiniMap.css";

interface MiniMapProps {
  events: TimelineEvent[];
  branches: Branch[];
  onRegionHover?: (region: Region | null) => void;
  variant?: "embedded" | "full";
  onActivateMapTab?: () => void;
}

// Map ISO 3166-1 numeric country codes to WW2 theater regions
const COUNTRY_TO_REGION: Record<string, Region> = {
  // North America
  "840": "north_america", // USA
  "124": "north_america", // Canada
  "484": "north_america", // Mexico

  // Western Europe
  "826": "western_europe", // UK
  "250": "western_europe", // France
  "380": "western_europe", // Italy
  "724": "western_europe", // Spain
  "620": "western_europe", // Portugal
  "056": "western_europe", // Belgium
  "528": "western_europe", // Netherlands
  "756": "western_europe", // Switzerland
  "040": "western_europe", // Austria
  "372": "western_europe", // Ireland
  "208": "western_europe", // Denmark
  "578": "western_europe", // Norway
  "752": "western_europe", // Sweden
  "276": "western_europe", // Germany
  "246": "western_europe", // Finland
  "300": "western_europe", // Greece

  // Eastern Europe
  "616": "eastern_europe", // Poland
  "643": "eastern_europe", // Russia
  "804": "eastern_europe", // Ukraine
  "112": "eastern_europe", // Belarus
  "642": "eastern_europe", // Romania
  "100": "eastern_europe", // Bulgaria
  "203": "eastern_europe", // Czech Republic
  "703": "eastern_europe", // Slovakia
  "348": "eastern_europe", // Hungary
  "688": "eastern_europe", // Serbia
  "191": "eastern_europe", // Croatia
  "070": "eastern_europe", // Bosnia
  "008": "eastern_europe", // Albania
  "807": "eastern_europe", // North Macedonia
  "498": "eastern_europe", // Moldova
  "440": "eastern_europe", // Lithuania
  "428": "eastern_europe", // Latvia
  "233": "eastern_europe", // Estonia
  "499": "eastern_europe", // Montenegro
  "705": "eastern_europe", // Slovenia

  // North Africa
  "012": "north_africa", // Algeria
  "434": "north_africa", // Libya
  "818": "north_africa", // Egypt
  "788": "north_africa", // Tunisia
  "504": "north_africa", // Morocco
  "732": "north_africa", // Western Sahara

  // East Asia
  "392": "east_asia", // Japan
  "156": "east_asia", // China
  "496": "east_asia", // Mongolia
  "408": "east_asia", // North Korea
  "410": "east_asia", // South Korea
  "158": "east_asia", // Taiwan

  // Southeast Asia
  "360": "southeast_asia", // Indonesia
  "608": "southeast_asia", // Philippines
  "704": "southeast_asia", // Vietnam
  "764": "southeast_asia", // Thailand
  "104": "southeast_asia", // Myanmar
  "458": "southeast_asia", // Malaysia
  "116": "southeast_asia", // Cambodia
  "418": "southeast_asia", // Laos
  "702": "southeast_asia", // Singapore
  "096": "southeast_asia", // Brunei

  // Pacific
  "036": "pacific", // Australia
  "554": "pacific", // New Zealand
  "598": "pacific", // Papua New Guinea
  "242": "pacific", // Fiji
  "090": "pacific", // Solomon Islands
};

// Map geographic regions to their WW2 theater branch
const REGION_TO_BRANCH: Record<Region, string> = {
  western_europe: "european",
  eastern_europe: "european",
  north_africa: "european",
  atlantic: "european",
  pacific: "pacific",
  east_asia: "pacific",
  southeast_asia: "pacific",
  north_america: "homefront",
};

const DIM_FILL = "#161628";
const DIM_STROKE = "#1e1e30";

const REGION_CENTERS: Record<Region, [number, number]> = {
  north_america: [-100, 40],
  western_europe: [5, 48],
  eastern_europe: [30, 52],
  north_africa: [15, 28],
  atlantic: [-30, 35],
  east_asia: [120, 35],
  southeast_asia: [110, 5],
  pacific: [160, -15],
};

export default function MiniMap({
  events,
  branches,
  onRegionHover,
  variant = "embedded",
  onActivateMapTab,
}: MiniMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isFull = variant === "full";
  const width = isFull ? 1200 : 360;
  const height = isFull ? 640 : 180;

  // Build branch color map: branch id -> color
  const branchColors = useMemo(() => {
    const map = new Map<string, string>();
    branches.forEach((b) => map.set(b.id, b.color));
    return map;
  }, [branches]);

  // Get color for a region based on its theater branch
  const getRegionColor = (region: Region): string => {
    const branchId = REGION_TO_BRANCH[region];
    return branchColors.get(branchId) || DIM_FILL;
  };

  // Determine which regions have events
  const activeRegions = useMemo(() => {
    const regions = new Set<Region>();
    events.forEach((e) => {
      if (e.region) regions.add(e.region);
    });
    return regions;
  }, [events]);

  // Legend entries: branch name + color for active theaters
  const legendEntries = useMemo(() => {
    const activeBranches = new Set<string>();
    activeRegions.forEach((r) => activeBranches.add(REGION_TO_BRANCH[r]));
    return branches.filter((b) => activeBranches.has(b.id));
  }, [activeRegions, branches]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    d3.select(svg).selectAll("*").remove();

    const projection = d3
      .geoNaturalEarth1()
      .scale(isFull ? 220 : 65)
      .translate([width / 2, height / 2 + (isFull ? 26 : 10)]);

    const path = d3.geoPath(projection);

    const world = worldData as unknown as Topology;
    const countries = topojson.feature(world, world.objects.countries as any) as any;

    const g = d3.select(svg).append("g");

    // Graticule
    const graticule = d3.geoGraticule().step([30, 30]);
    g.append("path")
      .datum(graticule())
      .attr("d", path as any)
      .attr("fill", "none")
      .attr("stroke", "#1a1a2e")
      .attr("stroke-width", isFull ? 0.6 : 0.3);

    // Countries colored by theater
    g.selectAll("path.country")
      .data(countries.features)
      .enter()
      .append("path")
      .attr("class", "country")
      .attr("d", path as any)
      .attr("fill", (d: any) => {
        const region = COUNTRY_TO_REGION[d.id];
        if (!region) return DIM_FILL;
        if (!activeRegions.has(region)) return DIM_FILL;
        return getRegionColor(region);
      })
      .attr("fill-opacity", (d: any) => {
        const region = COUNTRY_TO_REGION[d.id];
        if (!region || !activeRegions.has(region)) return 0.5;
        return isFull ? 0.55 : 0.45;
      })
      .attr("stroke", (d: any) => {
        const region = COUNTRY_TO_REGION[d.id];
        if (!region || !activeRegions.has(region)) return DIM_STROKE;
        return getRegionColor(region);
      })
      .attr("stroke-width", (d: any) => {
        const region = COUNTRY_TO_REGION[d.id];
        if (region && activeRegions.has(region)) return isFull ? 1 : 0.5;
        return isFull ? 0.6 : 0.3;
      })
      .style("cursor", (d: any) => {
        const region = COUNTRY_TO_REGION[d.id];
        return region ? "pointer" : "default";
      })
      .on("mouseenter", (_event: MouseEvent, d: any) => {
        const region = COUNTRY_TO_REGION[d.id];
        if (region) onRegionHover?.(region);
      })
      .on("mouseleave", () => {
        onRegionHover?.(null);
      });

    // Event dots
    events
      .filter((e) => e.region)
      .forEach((event, i) => {
        const center = REGION_CENTERS[event.region!];
        if (!center) return;
        const projected = projection(center);
        if (!projected) return;
        const color = branchColors.get(event.branch) || "#fff";
        const ox = ((i * 7) % 15) - 7;
        const oy = ((i * 5) % 11) - 5;
        g.append("circle")
          .attr("cx", projected[0] + ox)
          .attr("cy", projected[1] + oy)
          .attr("r", event.importance === "critical" ? (isFull ? 5 : 2.5) : isFull ? 3.2 : 1.5)
          .attr("fill", color)
          .attr("fill-opacity", 0.9)
          .attr("stroke", "#000")
          .attr("stroke-width", isFull ? 0.6 : 0.3);
      });
  }, [events, branches, branchColors, activeRegions, onRegionHover, width, height, isFull]);

  return (
    <div
      className={`mini-map mini-map--${variant}`}
      onClick={!isFull ? onActivateMapTab : undefined}
      role={!isFull ? "button" : undefined}
      tabIndex={!isFull && onActivateMapTab ? 0 : -1}
      onKeyDown={
        !isFull && onActivateMapTab
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onActivateMapTab();
              }
            }
          : undefined
      }
      aria-label={!isFull ? "Open map tab" : "Timeline map"}
    >
      <div className="mini-map-header">
        <span className="mini-map-title">Theater Map</span>
        {!isFull && (
          <button
            className="mini-map-expand-btn"
            onClick={(event) => {
              event.stopPropagation();
              onActivateMapTab?.();
            }}
            title="Open map tab"
          >
            Open
          </button>
        )}
      </div>
      {!isFull && <div className="mini-map-hint">Click map to open full Map tab</div>}
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" />
      {legendEntries.length > 0 && (
        <div className="mini-map-legend">
          {legendEntries.map((branch) => (
            <span key={branch.id} className="mini-map-legend-item">
              <span className="mini-map-legend-dot" style={{ background: branch.color }} />
              {branch.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}


