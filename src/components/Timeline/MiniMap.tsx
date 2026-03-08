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

    const result = new Map<Region, string>();
    regionMap.forEach((colors, region) => {
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
