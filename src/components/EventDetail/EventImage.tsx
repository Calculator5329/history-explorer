import type { EventImage as EventImageType } from "../../types/index.ts";
import ImageGallery from "./ImageGallery.tsx";

interface EventImageProps {
  url?: string;
  alt: string;
  images?: EventImageType[];
}

export default function EventImage({ url, alt, images }: EventImageProps) {
  if (images && images.length > 0) {
    return <ImageGallery images={images} alt={alt} />;
  }

  if (url) {
    return (
      <div className="event-image">
        <img src={url} alt={alt} />
      </div>
    );
  }

  return null;
}
