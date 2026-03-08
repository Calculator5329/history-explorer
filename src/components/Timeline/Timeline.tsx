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
