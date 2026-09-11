import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { ProductCardDto } from '@audio-commerce/shared';
import { ProductCard } from './ProductCard.js';
import { ProductGrid } from './ProductGrid.js';

const nova: ProductCardDto = {
  slug: 'aurelia-nova',
  name: 'Aurelia Nova',
  brand: { slug: 'aurelia', name: 'Aurelia' },
  category: { slug: 'over-ear', name: 'Over-ear' },
  priceFrom: '19999.00',
  priceTo: '24999.00',
  thumbnail: {
    url: 'https://picsum.photos/seed/aurelia-nova-0/800/800',
    altText: 'Aurelia Nova over-ear headphones in midnight black',
    position: 0,
  },
  inStock: true,
  featured: true,
};

describe('ProductCard', () => {
  it('renders as a link to /p/aurelia-nova', () => {
    render(
      <MemoryRouter>
        <ProductCard product={nova} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/p/aurelia-nova');
  });
});

describe('ProductGrid', () => {
  it('renders product cards in a listing region', () => {
    render(
      <MemoryRouter>
        <ProductGrid products={[nova]} />
      </MemoryRouter>,
    );
    expect(document.getElementById('product-grid')).toBeTruthy();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/p/aurelia-nova');
  });
});
