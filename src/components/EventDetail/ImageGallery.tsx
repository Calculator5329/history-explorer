import { useState } from "react";
import type { EventImage } from "../../types/index.ts";

interface ImageGalleryProps {
  images: EventImage[];
  alt: string;
}

export default function ImageGallery({ images, alt }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) return null;

  const active = images[activeIndex];

  return (
    <div className="image-gallery">
      <div className="image-gallery-main">
        <img src={active.url} alt={active.caption || alt} />
        {active.caption && (
          <div className="image-gallery-caption">
            {active.caption}
            {active.source && <span> — {active.source}</span>}
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="image-gallery-thumbs">
          {images.map((img, i) => (
            <div
              key={i}
              className={`image-gallery-thumb ${i === activeIndex ? "active" : ""}`}
              onClick={() => setActiveIndex(i)}
            >
              <img src={img.url} alt={img.caption || `${alt} ${i + 1}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
