import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Timeline from "../components/Timeline/Timeline.tsx";
import { useTimeline } from "../hooks/useTimeline.ts";
import { sampleTopic, sampleEvents } from "../data/ww2-sample.ts";

export default function TimelinePage() {
  const navigate = useNavigate();
  const { topicId } = useParams();
  const { topic, events, loading, error } = useTimeline(topicId);

  // Fall back to sample data if Firestore fails or is empty
  const activeTopic = topic || sampleTopic;
  const activeEvents = events.length > 0 ? events : sampleEvents;

  const handleEventClick = useCallback(
    (eventId: string) => {
      navigate(`/topic/${topicId}/event/${eventId}`);
    },
    [navigate, topicId]
  );

  if (loading) {
    return (
      <div style={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>
        Loading timeline...
      </div>
    );
  }

  if (error) {
    // Silently fall back to sample data
    console.warn("Firestore error, using sample data:", error);
  }

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Timeline
        events={activeEvents}
        branches={activeTopic.branches}
        onEventClick={handleEventClick}
      />
    </div>
  );
}
