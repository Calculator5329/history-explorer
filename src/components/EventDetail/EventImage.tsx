interface EventImageProps {
  url?: string;
  alt: string;
}

export default function EventImage({ url, alt }: EventImageProps) {
  if (!url) return null;

  return (
    <div className="event-image">
      <img src={url} alt={alt} />
    </div>
  );
}
