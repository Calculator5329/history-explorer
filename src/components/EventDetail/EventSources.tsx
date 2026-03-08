import type { Source } from "../../types/index.ts";

interface EventSourcesProps {
  sources: Source[];
}

export default function EventSources({ sources }: EventSourcesProps) {
  if (sources.length === 0) return null;

  return (
    <div className="event-sources">
      <h3>Sources</h3>
      <ol>
        {sources.map((source, i) => (
          <li key={i}>
            <a href={source.url} target="_blank" rel="noopener">
              {source.title}
            </a>
            {source.snippet && <p className="source-snippet">{source.snippet}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
