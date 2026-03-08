import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import EventImage from "../components/EventDetail/EventImage.tsx";
import EventContent from "../components/EventDetail/EventContent.tsx";
import EventSources from "../components/EventDetail/EventSources.tsx";
import RelatedEvents from "../components/EventDetail/RelatedEvents.tsx";
import { useEvent } from "../hooks/useEvent.ts";
import { useTimeline } from "../hooks/useTimeline.ts";
import { enrichEvent, generateEventContent } from "../services/event-enricher.ts";
import { sampleEvents, sampleTopic } from "../data/ww2-sample.ts";
import "./EventPage.css";

export default function EventPage() {
  const { topicId, eventId } = useParams();
  const { event: firestoreEvent, loading: eventLoading, setEvent } = useEvent(topicId, eventId);
  const { topic, events: allEvents } = useTimeline(topicId);
  const [contentLoading, setContentLoading] = useState(false);

  // Fall back to sample data
  const event = firestoreEvent || sampleEvents.find((e) => e.id === eventId);
  const activeTopic = topic || sampleTopic;
  const activeEvents = allEvents.length > 0 ? allEvents : sampleEvents;
  const branch = activeTopic.branches.find((b) => b.id === event?.branch);

  // Trigger enrichment on mount if needed
  useEffect(() => {
    if (!event || !topicId || !firestoreEvent) return;

    let cancelled = false;

    async function doEnrich() {
      if (!event || !topicId) return;

      // Step 1: Enrich (Wikipedia + sources) if not already done
      let enriched = event;
      if (!event.enriched) {
        enriched = await enrichEvent(topicId, event);
        if (cancelled) return;
        setEvent(enriched);
      }

      // Step 2: Generate content if not already done
      if (!enriched.content) {
        setContentLoading(true);
        const content = await generateEventContent(topicId, enriched);
        if (cancelled) return;
        setEvent({ ...enriched, content });
        setContentLoading(false);
      }
    }

    doEnrich();

    return () => {
      cancelled = true;
    };
  }, [event?.id, event?.enriched, event?.content, topicId, firestoreEvent, setEvent]);

  if (eventLoading) {
    return (
      <div className="event-page">
        <p style={{ color: "#888" }}>Loading event...</p>
      </div>
    );
  }

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
        <EventContent
          content={event.content}
          summary={event.summary}
          sources={event.sources}
          loading={contentLoading}
        />
        <RelatedEvents connections={event.connections} allEvents={activeEvents} />
        <EventSources sources={event.sources} />
      </main>
    </div>
  );
}
