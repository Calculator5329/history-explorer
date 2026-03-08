import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Timeline from "../components/Timeline/Timeline.tsx";
import { useTimeline } from "../hooks/useTimeline.ts";
import { useTopics } from "../hooks/useTopics.ts";
import {
  createTopicFromDraft,
  expandTimeline,
  generateSeedEvents,
  generateTopicBranches,
  persistProposedEvents,
  runDeepenPass,
} from "../services/timeline-builder.ts";
import { sampleTopic, sampleEvents } from "../data/ww2-sample.ts";
import type { BranchDraft, ProposedEvent, TopicDraft } from "../types/index.ts";
import "./TimelinePage.css";

const DEFAULT_TOPIC_DRAFT: TopicDraft = {
  name: "",
  description: "",
  timeframe: "",
};

const IS_PRODUCTION = import.meta.env.PROD;

export default function TimelinePage() {
  const navigate = useNavigate();
  const params = useParams();
  const topicId = params.topicId || sampleTopic.id;

  const { topic, events, loading, error, refresh } = useTimeline(topicId);
  const { topics, refresh: refreshTopics } = useTopics();

  const activeTopic = topic || sampleTopic;
  const activeEvents = events.length > 0 ? events : sampleEvents;

  const topicOptions = useMemo(() => {
    const byId = new Map(topics.map((t) => [t.id, t]));
    if (!byId.has(activeTopic.id)) {
      byId.set(activeTopic.id, activeTopic);
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [topics, activeTopic]);

  useEffect(() => {
    document.title = `${activeTopic.name} Timeline | History Explorer`;
  }, [activeTopic.name]);

  const [expandPreview, setExpandPreview] = useState<ProposedEvent[] | null>(null);
  const [expandBusy, setExpandBusy] = useState(false);
  const [expandError, setExpandError] = useState<string | null>(null);
  const [expandSaving, setExpandSaving] = useState(false);
  const [enrichBusy, setEnrichBusy] = useState(false);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardDraft, setWizardDraft] = useState<TopicDraft>(DEFAULT_TOPIC_DRAFT);
  const [wizardBranches, setWizardBranches] = useState<BranchDraft[]>([]);
  const [wizardSeedPreview, setWizardSeedPreview] = useState<ProposedEvent[]>([]);
  const [wizardBusy, setWizardBusy] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

  const handleEventClick = useCallback(
    (eventId: string) => {
      navigate(`/topic/${topicId}/event/${eventId}`);
    },
    [navigate, topicId]
  );

  const handleTopicChange = (nextTopicId: string) => {
    if (!nextTopicId || nextTopicId === topicId) return;
    navigate(`/topic/${nextTopicId}`);
  };

  const handleEnrichTimeline = async () => {
    if (IS_PRODUCTION) {
      setExpandError("Timeline enrichment is disabled in production.");
      return;
    }

    const unenriched = activeEvents.filter((e) => !e.enriched);
    if (unenriched.length === 0) {
      setExpandError("All events are already enriched.");
      return;
    }

    setExpandError(null);
    setEnrichBusy(true);
    try {
      runDeepenPass(topicId, activeEvents, unenriched);
      setExpandError(`Enrichment started for ${unenriched.length} event(s). Refresh in a moment to see results.`);
    } catch (err) {
      setExpandError(err instanceof Error ? err.message : "Failed to start enrichment");
    } finally {
      setEnrichBusy(false);
    }
  };

  const handleOpenExpand = async () => {
    if (IS_PRODUCTION) {
      setExpandError("Timeline expansion is disabled in production.");
      return;
    }

    setExpandError(null);
    setExpandBusy(true);
    try {
      const preview = await expandTimeline(activeTopic, activeEvents, 10);
      setExpandPreview(preview);
      if (preview.length === 0) {
        setExpandError("No new unique events were proposed. Try again.");
      }
    } catch (err) {
      setExpandError(err instanceof Error ? err.message : "Failed to generate expansion preview");
      setExpandPreview(null);
    } finally {
      setExpandBusy(false);
    }
  };

  const handleConfirmExpand = async () => {
    if (IS_PRODUCTION) {
      setExpandError("Timeline expansion is disabled in production.");
      setExpandPreview(null);
      return;
    }

    if (!expandPreview || expandPreview.length === 0) {
      setExpandPreview(null);
      return;
    }

    setExpandSaving(true);
    setExpandError(null);
    try {
      const created = await persistProposedEvents(topicId, expandPreview, "expansion", activeEvents);
      runDeepenPass(topicId, activeEvents, created);
      setExpandPreview(null);
      refresh();
    } catch (err) {
      setExpandError(err instanceof Error ? err.message : "Failed to persist expanded events");
    } finally {
      setExpandSaving(false);
    }
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setWizardStep(1);
    setWizardDraft(DEFAULT_TOPIC_DRAFT);
    setWizardBranches([]);
    setWizardSeedPreview([]);
    setWizardError(null);
    setWizardBusy(false);
  };

  const openWizard = () => {
    if (IS_PRODUCTION) {
      setExpandError("Starting another historical event is disabled in production.");
      return;
    }

    setWizardOpen(true);
    setWizardStep(1);
    setWizardDraft(DEFAULT_TOPIC_DRAFT);
    setWizardBranches([]);
    setWizardSeedPreview([]);
    setWizardError(null);
  };

  const handleWizardNext = async () => {
    if (IS_PRODUCTION) {
      setWizardError("Starting another historical event is disabled in production.");
      return;
    }

    setWizardError(null);
    if (wizardStep === 1) {
      if (!wizardDraft.name.trim() || !wizardDraft.timeframe.trim()) {
        setWizardError("Topic name and timeframe are required.");
        return;
      }
      setWizardBusy(true);
      try {
        const branches = await generateTopicBranches(wizardDraft);
        setWizardBranches(branches);
        setWizardStep(2);
      } catch (err) {
        setWizardError(err instanceof Error ? err.message : "Failed to generate branches");
      } finally {
        setWizardBusy(false);
      }
      return;
    }

    if (wizardStep === 2) {
      setWizardBusy(true);
      try {
        const seeds = await generateSeedEvents(wizardDraft, wizardBranches, 10);
        setWizardSeedPreview(seeds);
        setWizardStep(3);
      } catch (err) {
        setWizardError(err instanceof Error ? err.message : "Failed to generate seed events");
      } finally {
        setWizardBusy(false);
      }
      return;
    }
  };

  const handleWizardBack = () => {
    setWizardError(null);
    if (wizardStep === 2) setWizardStep(1);
    if (wizardStep === 3) setWizardStep(2);
  };

  const handleWizardCreate = async () => {
    if (IS_PRODUCTION) {
      setWizardError("Starting another historical event is disabled in production.");
      return;
    }

    if (wizardSeedPreview.length === 0) {
      setWizardError("No seed events available to create the timeline.");
      return;
    }

    setWizardBusy(true);
    setWizardError(null);
    try {
      const { topicId: newTopicId } = await createTopicFromDraft(wizardDraft, wizardBranches, wizardSeedPreview);
      await refreshTopics();
      closeWizard();
      navigate(`/topic/${newTopicId}`);
    } catch (err) {
      setWizardError(err instanceof Error ? err.message : "Failed to create topic");
    } finally {
      setWizardBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="timeline-page">
        <div className="timeline-loading">Loading timeline...</div>
      </div>
    );
  }

  if (error) {
    console.warn("Firestore error, using sample data:", error);
  }

  return (
    <div className="timeline-page">
      <header className="timeline-header-bar">
        <div className="timeline-topic-picker">
          <label htmlFor="topic-select">Timeline</label>
          <select
            id="topic-select"
            value={topicId}
            onChange={(e) => handleTopicChange(e.target.value)}
          >
            {topicOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

        <div className="timeline-header-actions">
          <button
            type="button"
            className="timeline-btn"
            onClick={handleEnrichTimeline}
            disabled={IS_PRODUCTION || enrichBusy}
            title={IS_PRODUCTION ? "Disabled in production" : undefined}
          >
            {enrichBusy ? "Enriching..." : "Enrich Timeline"}
          </button>
          <button
            type="button"
            className="timeline-btn"
            onClick={handleOpenExpand}
            disabled={IS_PRODUCTION || expandBusy || expandSaving}
            title={IS_PRODUCTION ? "Disabled in production" : undefined}
          >
            {expandBusy ? "Generating..." : "Expand Timeline"}
          </button>
          <button
            type="button"
            className="timeline-btn timeline-btn-primary"
            onClick={openWizard}
            disabled={IS_PRODUCTION}
            title={IS_PRODUCTION ? "Disabled in production" : undefined}
          >
            Start Another Historical Event
          </button>
          <Link to={`/stats?topic=${topicId}`} className="timeline-stats-link">Stats</Link>
        </div>
      </header>

      {expandError && <div className="timeline-inline-error">{expandError}</div>}

      <main className="timeline-body">
        <Timeline
          events={activeEvents}
          branches={activeTopic.branches}
          onEventClick={handleEventClick}
        />
      </main>

      {expandPreview && (
        <div className="timeline-modal-overlay" role="dialog" aria-modal="true">
          <div className="timeline-modal">
            <h2>Expand Timeline Preview</h2>
            <p>Proposed {expandPreview.length} new events. Review before writing.</p>
            <div className="timeline-modal-list">
              {expandPreview.map((event, idx) => (
                <div key={`${event.title}-${idx}`} className="timeline-preview-item">
                  <div className="timeline-preview-top">
                    <strong>{event.title}</strong>
                    <span>{event.date}</span>
                  </div>
                  <div className="timeline-preview-meta">{event.branch} � {event.importance}</div>
                  <p>{event.summary}</p>
                </div>
              ))}
            </div>
            <div className="timeline-modal-actions">
              <button type="button" className="timeline-btn" onClick={() => setExpandPreview(null)} disabled={expandSaving}>
                Cancel
              </button>
              <button type="button" className="timeline-btn timeline-btn-primary" onClick={handleConfirmExpand} disabled={expandSaving}>
                {expandSaving ? "Saving..." : "Confirm & Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {wizardOpen && (
        <div className="timeline-modal-overlay" role="dialog" aria-modal="true">
          <div className="timeline-modal timeline-modal-wide">
            <h2>Start Another Historical Event</h2>
            <p>Step {wizardStep} of 3</p>

            {wizardStep === 1 && (
              <div className="timeline-form-grid">
                <label>
                  Topic Name
                  <input
                    value={wizardDraft.name}
                    onChange={(e) => setWizardDraft((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Cold War"
                  />
                </label>
                <label>
                  Timeframe
                  <input
                    value={wizardDraft.timeframe}
                    onChange={(e) => setWizardDraft((prev) => ({ ...prev, timeframe: e.target.value }))}
                    placeholder="e.g., 1947-1991"
                  />
                </label>
                <label className="timeline-form-full">
                  Description
                  <textarea
                    value={wizardDraft.description}
                    onChange={(e) => setWizardDraft((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Short scope and angle for this timeline"
                  />
                </label>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="timeline-modal-list">
                {wizardBranches.map((branch) => (
                  <div key={branch.id} className="timeline-preview-item">
                    <div className="timeline-preview-top">
                      <strong>{branch.name}</strong>
                      <span>{branch.id}</span>
                    </div>
                    <div className="timeline-preview-meta">Color: {branch.color}</div>
                  </div>
                ))}
              </div>
            )}

            {wizardStep === 3 && (
              <div className="timeline-modal-list">
                {wizardSeedPreview.map((event, idx) => (
                  <div key={`${event.title}-${idx}`} className="timeline-preview-item">
                    <div className="timeline-preview-top">
                      <strong>{event.title}</strong>
                      <span>{event.date}</span>
                    </div>
                    <div className="timeline-preview-meta">{event.branch} � {event.importance}</div>
                    <p>{event.summary}</p>
                  </div>
                ))}
              </div>
            )}

            {wizardError && <div className="timeline-inline-error">{wizardError}</div>}

            <div className="timeline-modal-actions">
              <button type="button" className="timeline-btn" onClick={closeWizard} disabled={wizardBusy}>
                Close
              </button>
              {wizardStep > 1 && (
                <button type="button" className="timeline-btn" onClick={handleWizardBack} disabled={wizardBusy}>
                  Back
                </button>
              )}
              {wizardStep < 3 ? (
                <button type="button" className="timeline-btn timeline-btn-primary" onClick={handleWizardNext} disabled={wizardBusy}>
                  {wizardBusy ? "Working..." : "Next"}
                </button>
              ) : (
                <button type="button" className="timeline-btn timeline-btn-primary" onClick={handleWizardCreate} disabled={wizardBusy}>
                  {wizardBusy ? "Creating..." : "Create Timeline"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



