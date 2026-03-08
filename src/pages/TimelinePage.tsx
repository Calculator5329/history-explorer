import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Timeline from "../components/Timeline/Timeline.tsx";
import { sampleTopic, sampleEvents } from "../data/ww2-sample.ts";

export default function TimelinePage() {
  const navigate = useNavigate();
  const { topicId } = useParams();

  const handleEventClick = useCallback(
    (eventId: string) => {
      navigate(`/topic/${topicId}/event/${eventId}`);
    },
    [navigate, topicId]
  );

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Timeline
        events={sampleEvents}
        branches={sampleTopic.branches}
        onEventClick={handleEventClick}
      />
    </div>
  );
}
