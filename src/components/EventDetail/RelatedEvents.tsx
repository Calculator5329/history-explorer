import { Link, useParams } from "react-router-dom";
import type { TimelineEvent } from "../../types/index.ts";

interface RelatedEventsProps {
  connections: string[];
  allEvents: TimelineEvent[];
}

export default function RelatedEvents({ connections, allEvents }: RelatedEventsProps) {
  const { topicId } = useParams();
  const related = allEvents.filter((e) => connections.includes(e.id));

  if (related.length === 0) return null;

  return (
    <div className="related-events">
      <h3>Related Events</h3>
      <div className="related-list">
        {related.map((event) => (
          <Link key={event.id} to={`/topic/${topicId}/event/${event.id}`} className="related-card">
            <span className="related-title">{event.title}</span>
            <span className="related-date">{event.date}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
