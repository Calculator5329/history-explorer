import type { EventImage as EventImageType } from "../../types/index.ts";
import ImageGallery from "./ImageGallery.tsx";

interface EventImageProps {
  alt: string;
  images?: EventImageType[];
}

const WIKIMEDIA_PATTERN = /wikipedia|wikimedia|commons\.wikimedia/i;

export default function EventImage({ alt, images }: EventImageProps) {
  if (!images || images.length === 0) return null;

  // Sort non-Wikimedia sources first for variety
  const sorted = [...images].sort((a, b) => {
    const aWiki = WIKIMEDIA_PATTERN.test(`${a.url || ""} ${a.source || ""}`);
    const bWiki = WIKIMEDIA_PATTERN.test(`${b.url || ""} ${b.source || ""}`);
    if (aWiki === bWiki) return 0;
    return aWiki ? 1 : -1;
  });

  return <ImageGallery images={sorted} alt={alt} />;
}
