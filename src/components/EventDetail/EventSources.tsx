import type { Source } from "../../types/index.ts";

interface EventSourcesProps {
  sources: Source[];
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

export default function EventSources({ sources }: EventSourcesProps) {
  if (sources.length === 0) return null;

  return (
    <div className="event-sources">
      <h3>Sources</h3>
      <ol>
        {sources.map((source, i) => {
          const href = toHref(source.url);
          return (
            <li key={i}>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {source.title || href}
                </a>
              ) : (
                <span>{source.title || "Unresolved source URL"}</span>
              )}
              {source.snippet && <p className="source-snippet">{source.snippet}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
