import { useState, useRef, useEffect, type ReactNode } from "react";
import type { Source } from "../../types/index.ts";

interface EventContentProps {
  content?: string;
  summary: string;
  sources: Source[];
  loading?: boolean;
}

function toHref(url?: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim().replace(/[),.;]+$/g, "");
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate).href;
  } catch {
    return undefined;
  }
}

function getHostname(url?: string): string {
  const href = toHref(url);
  if (!href) return "unknown source";
  try {
    return new URL(href).hostname;
  } catch {
    return "unknown source";
  }
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

  const text = content || summary || "";
  if (!text) return null;

  return <div className="event-content">{renderWithCitations(text, sources)}</div>;
}

function renderWithCitations(text: string, sources: Source[]): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /\[(\d+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const num = Number.parseInt(match[1], 10);
    const source = sources[num - 1];

    if (source && toHref(source.url)) {
      parts.push(<CitationLink key={`cite-${match.index}`} num={num} source={source} />);
    } else {
      parts.push(
        <span key={`cite-${match.index}`} className="citation citation-no-source">
          [{num}]
        </span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function CitationLink({ num, source }: { num: number; source: Source }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<"above" | "below">("above");
  const linkRef = useRef<HTMLAnchorElement>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const href = toHref(source.url);

  useEffect(() => {
    if (showTooltip && linkRef.current) {
      const rect = linkRef.current.getBoundingClientRect();
      setTooltipPos(rect.top < 200 ? "below" : "above");
    }
  }, [showTooltip]);

  const handleEnter = () => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    setShowTooltip(true);
  };

  const handleLeave = () => {
    hideTimeout.current = setTimeout(() => setShowTooltip(false), 200);
  };

  if (!href) {
    return <span className="citation citation-no-source">[{num}]</span>;
  }

  return (
    <span className="citation-wrapper" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <a
        ref={linkRef}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="citation"
        aria-label={`Source ${num}: ${source.title}`}
      >
        [{num}]
      </a>
      {showTooltip && (
        <div className={`citation-tooltip ${tooltipPos}`} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
          <div className="citation-tooltip-header">
            <span className="citation-tooltip-num">[{num}]</span>
            <a href={href} target="_blank" rel="noopener noreferrer" className="citation-tooltip-title">
              {source.title}
            </a>
          </div>
          {source.snippet && <p className="citation-tooltip-snippet">{source.snippet}</p>}
          <div className="citation-tooltip-url">{getHostname(href)}</div>
        </div>
      )}
    </span>
  );
}

