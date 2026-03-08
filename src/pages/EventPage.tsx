import { useParams, Link } from "react-router-dom";
import EventImage from "../components/EventDetail/EventImage.tsx";
import EventContent from "../components/EventDetail/EventContent.tsx";
import EventSources from "../components/EventDetail/EventSources.tsx";
import RelatedEvents from "../components/EventDetail/RelatedEvents.tsx";
import { sampleEvents, sampleTopic } from "../data/ww2-sample.ts";
import "./EventPage.css";

export default function EventPage() {
  const { topicId, eventId } = useParams();
  const event = sampleEvents.find((e) => e.id === eventId);
  const branch = sampleTopic.branches.find((b) => b.id === event?.branch);

  if (!event) {
    return (
      <div className="event-page">
        <p>Event not found.</p>
        <Link to={`/topic/${topicId}`}>Back to Timeline</Link>
      </div>
    );
  }

  return (
    <div className="event-page">
      <header className="event-header">
        <Link to={`/topic/${topicId}`} className="back-link">
          &larr; Back to Timeline
        </Link>
        {event.sources.length > 0 && (
          <span className="source-count">Sources: {event.sources.length}</span>
        )}
      </header>

      <main className="event-main">
        <div className="event-title-section">
          {event.importance === "critical" && <span className="importance-star">{"\u2605"}</span>}
          <h1>{event.title}</h1>
          <div className="event-meta">
            <time>{event.date}{event.endDate ? ` \u2013 ${event.endDate}` : ""}</time>
            {branch && (
              <span className="branch-badge" style={{ borderColor: branch.color, color: branch.color }}>
                {branch.name}
              </span>
            )}
          </div>
        </div>

        <EventImage url={event.wikipediaImageUrl} alt={event.title} />
        <EventContent content={event.content} summary={event.summary} sources={event.sources} />
        <RelatedEvents connections={event.connections} allEvents={sampleEvents} />
        <EventSources sources={event.sources} />
      </main>
    </div>
  );
}
