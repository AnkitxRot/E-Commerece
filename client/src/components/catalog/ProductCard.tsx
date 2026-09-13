import { Link } from 'react-router-dom';
import type { ProductCardDto } from '@audio-commerce/shared';
import { Price } from './Price.js';
import { RatingStars } from '../RatingStars.js';
import { WishlistButton } from '../WishlistButton.js';

export function ProductCard({ product }: { product: ProductCardDto }) {
  return (
    <div className="group relative text-ink duration-base ease-standard">
      <WishlistButton
        slug={product.slug}
        className="absolute right-1 top-1 z-10 bg-glass backdrop-blur-glass"
      />
      <Link to={`/p/${product.slug}`} className="block">
        <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-lg bg-surface">
          {product.thumbnail ? (
            <img
              src={product.thumbnail.url}
              alt={product.thumbnail.altText}
              width={800}
              height={800}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover duration-base ease-standard group-hover:scale-[1.03]"
            />
          ) : (
            <div className="h-full w-full bg-surface" aria-hidden="true" />
          )}
          {!product.inStock ? (
            <span className="absolute left-2 top-2 rounded-sm bg-ink/80 px-2 py-1 text-xs font-medium text-white">
              Out of stock
            </span>
          ) : product.compareAtPrice ? (
            <span className="absolute left-2 top-2 rounded-sm bg-sale px-2 py-1 text-xs font-medium text-white">
              Sale
            </span>
          ) : null}
        </div>
        {product.brand ? <p className="text-xs uppercase tracking-wide text-ink-muted">{product.brand.name}</p> : null}
        <p className="mt-0.5 font-medium leading-snug text-ink">{product.name}</p>
        <div className="mt-1">
          <RatingStars rating={product.rating} reviewCount={product.reviewCount} />
        </div>
        <div className="mt-1.5">
          <Price from={product.priceFrom} to={product.priceTo} compareAtPrice={product.compareAtPrice} />
        </div>
      </Link>
    </div>
  );
}
