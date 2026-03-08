import type { Source } from "../../types/index.ts";

interface EventContentProps {
  content?: string;
  summary: string;
  sources: Source[];
  loading?: boolean;
}

export default function EventContent({ content, summary, sources, loading }: EventContentProps) {
  if (loading) {
    return (
      <div className="event-content">
        <div className="content-skeleton">
          <div className="skeleton-line" style={{ width: "100%" }} />
          <div className="skeleton-line" style={{ width: "90%" }} />
          <div className="skeleton-line" style={{ width: "95%" }} />
          <div className="skeleton-line" style={{ width: "80%" }} />
        </div>
      </div>
    );
  }

  const text = content || summary;

  // Replace [N] citation markers with clickable links
  const rendered = text.replace(/\[(\d+)\]/g, (_match, num) => {
    const idx = parseInt(num) - 1;
    const source = sources[idx];
    if (source) {
      return `<a href="${source.url}" target="_blank" rel="noopener" class="citation" title="${source.title}">[${num}]</a>`;
    }
    return `[${num}]`;
  });

  return (
    <div className="event-content" dangerouslySetInnerHTML={{ __html: rendered }} />
  );
}
