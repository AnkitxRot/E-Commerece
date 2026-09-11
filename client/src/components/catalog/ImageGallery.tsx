import { useState } from 'react';
import type { ImageDto } from '@audio-commerce/shared';

export function ImageGallery({ images }: { images: ImageDto[] }) {
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const current = images[active] ?? images[0];
  if (!current) return null;

  return (
    <div className="flex flex-col gap-3">
      {failed[active] ? (
        <div className="aspect-square w-full rounded-md bg-surface" role="img" aria-label={current.altText} />
      ) : (
        <img
          src={current.url}
          alt={current.altText}
          width={800}
          height={800}
          fetchPriority="high"
          decoding="async"
          className="aspect-square w-full rounded-md object-cover"
          onError={() => setFailed((prev) => ({ ...prev, [active]: true }))}
        />
      )}
      {images.length > 1 ? (
        <ul className="flex flex-wrap gap-2">
          {images.map((image, index) => (
            <li key={`${image.position}-${image.url}`}>
              <button
                type="button"
                aria-label={image.altText}
                aria-current={index === active ? 'true' : undefined}
                className="min-h-[44px] min-w-[44px] overflow-hidden rounded-md border border-border duration-snap"
                onClick={() => setActive(index)}
              >
                <img
                  src={image.url}
                  alt=""
                  width={80}
                  height={80}
                  loading="lazy"
                  decoding="async"
                  className="h-16 w-16 object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
