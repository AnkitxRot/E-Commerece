import { Link } from 'react-router-dom';
import type { ProductCardDto } from '@audio-commerce/shared';
import { Price } from './Price.js';

export function ProductCard({ product }: { product: ProductCardDto }) {
  return (
    <Link
      to={`/p/${product.slug}`}
      className="block rounded-md border border-border bg-surface p-3 text-ink duration-snap"
    >
      {product.thumbnail ? (
        <img
          src={product.thumbnail.url}
          alt={product.thumbnail.altText}
          width={800}
          height={800}
          loading="lazy"
          decoding="async"
          className="mb-3 aspect-square w-full rounded-md object-cover"
        />
      ) : (
        <div className="mb-3 aspect-square w-full rounded-md bg-surface" aria-hidden="true" />
      )}
      <p className="font-medium text-ink">{product.name}</p>
      {product.brand ? <p className="text-sm text-ink-muted">{product.brand.name}</p> : null}
      <Price from={product.priceFrom} to={product.priceTo} />
      {product.inStock ? null : <p className="text-sm text-ink-muted">Out of stock</p>}
    </Link>
  );
}
