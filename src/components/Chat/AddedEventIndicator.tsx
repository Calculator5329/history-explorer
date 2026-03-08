interface AddedEventIndicatorProps {
  eventIds: string[];
}

export default function AddedEventIndicator({ eventIds }: AddedEventIndicatorProps) {
  if (eventIds.length === 0) return null;

  return (
    <div className="added-events-indicator">
      {eventIds.map((id) => (
        <div key={id} className="added-event-badge">
          + Added to timeline
        </div>
      ))}
    </div>
  );
}
