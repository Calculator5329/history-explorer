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
    if (!containerRef.current || events.length === 0 || !branches || branches.length === 0) return;

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
