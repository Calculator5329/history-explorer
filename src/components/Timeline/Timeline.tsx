import { useRef, useEffect, useState } from "react";
import type { TimelineEvent, Branch } from "../../types/index.ts";
import { renderTimeline } from "./timeline-renderer.ts";
import MiniMap from "./MiniMap.tsx";
import "./Timeline.css";

interface TimelineProps {
  events: TimelineEvent[];
  branches: Branch[];
  onEventClick: (eventId: string) => void;
}

type TimelineView = "timeline" | "map";

export default function Timeline({ events, branches, onEventClick }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapTabUnlocked, setMapTabUnlocked] = useState(false);
  const [view, setView] = useState<TimelineView>("timeline");

  useEffect(() => {
    if (view !== "timeline") return;
    if (!containerRef.current || events.length === 0 || !branches || branches.length === 0) return;

    function render() {
      if (!containerRef.current) return;
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
  }, [events, branches, onEventClick, view]);

  const handleActivateMapTab = () => {
    setMapTabUnlocked(true);
    setView("map");
  };

  return (
    <div className="timeline-root">
      {mapTabUnlocked && (
        <div className="timeline-view-tabs">
          <button
            type="button"
            className={`timeline-view-tab ${view === "timeline" ? "timeline-view-tab-active" : ""}`}
            onClick={() => setView("timeline")}
          >
            Timeline
          </button>
          <button
            type="button"
            className={`timeline-view-tab ${view === "map" ? "timeline-view-tab-active" : ""}`}
            onClick={() => setView("map")}
          >
            Map
          </button>
        </div>
      )}

      {view === "timeline" ? (
        <>
          <div ref={containerRef} className="timeline-container" />
          {!mapTabUnlocked && (
            <MiniMap events={events} branches={branches} variant="embedded" onActivateMapTab={handleActivateMapTab} />
          )}
        </>
      ) : (
        <div className="timeline-map-pane">
          <MiniMap events={events} branches={branches} variant="full" />
        </div>
      )}
    </div>
  );
}
