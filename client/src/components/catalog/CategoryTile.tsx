import { Link } from 'react-router-dom';
import type { HomeCategoryTileDto } from '@audio-commerce/shared';

export function CategoryTile({ category }: { category: HomeCategoryTileDto }) {
  return (
    <Link
      to={`/c/${category.slug}`}
      className="group relative flex aspect-[4/5] items-end rounded-lg bg-surface duration-base ease-standard focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
    >
      <div className="absolute inset-0 overflow-hidden rounded-lg">
        {category.image ? (
          <img
            src={category.image.url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover duration-base ease-standard group-hover:scale-105"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" aria-hidden="true" />
      </div>
      <span className="relative z-10 p-4 text-base font-medium text-white">{category.name}</span>
    </Link>
  );
}
