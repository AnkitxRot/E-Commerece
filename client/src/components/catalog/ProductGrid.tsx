import type { ProductCardDto } from '@audio-commerce/shared';
import { ProductCard } from './ProductCard.js';

export function ProductGrid({ products }: { products: ProductCardDto[] }) {
  return (
    <ul id="product-grid" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <li key={product.slug}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
