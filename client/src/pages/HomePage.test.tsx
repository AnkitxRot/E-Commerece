import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentBlockType, type HomeResponse, type ProductCardDto } from '@audio-commerce/shared';
import { ApiError, apiFetch } from '../lib/apiClient.js';
import HomePage from './HomePage.js';

vi.mock('../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/apiClient.js')>();
  return { ...actual, apiFetch: vi.fn() };
});

const nova: ProductCardDto = {
  slug: 'aurelia-nova',
  name: 'Nova',
  brand: { slug: 'aurelia', name: 'Aurelia' },
  category: { slug: 'over-ear', name: 'Over-ear' },
  priceFrom: '19999.00',
  priceTo: '24999.00',
  thumbnail: null,
  inStock: true,
  featured: true,
};

const ion: ProductCardDto = {
  slug: 'sable-ion',
  name: 'Sable Ion',
  brand: { slug: 'sable', name: 'Sable' },
  category: { slug: 'in-ear', name: 'In-ear' },
  priceFrom: '18990.00',
  priceTo: '21990.00',
  thumbnail: null,
  inStock: true,
  featured: false,
};

const home: HomeResponse = {
  hero: {
    title: 'Listen closer',
    subtitle: 'Reference headphones and desktop audio.',
    imageUrl: 'https://picsum.photos/seed/aurelia-hero/1600/900',
    ctaLabel: 'Shop headphones',
    ctaHref: '/c/headphones',
  },
  blocks: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      type: ContentBlockType.BANNER,
      position: 0,
      payload: { title: 'Spring tuning', ctaLabel: 'See cables', ctaHref: '/c/cables' },
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      type: ContentBlockType.ANNOUNCEMENT,
      position: 1,
      payload: { message: 'Free shipping this week', href: '/products' },
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      type: ContentBlockType.FEATURED_COLLECTION,
      position: 2,
      payload: { title: 'Desk stack' },
      products: [ion],
    },
  ],
  featured: [nova],
};

describe('HomePage', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('renders hero CTA, typed blocks, and featured from GET /api/catalog/home only', async () => {
    vi.mocked(apiFetch).mockResolvedValue(home);
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Listen closer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop headphones' })).toHaveAttribute('href', '/c/headphones');
    expect(screen.getByText('Spring tuning')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See cables' })).toHaveAttribute('href', '/c/cables');
    expect(screen.getByRole('link', { name: 'Free shipping this week' })).toHaveAttribute('href', '/products');
    expect(screen.getByRole('heading', { name: 'Desk stack' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sable Ion/ })).toHaveAttribute('href', '/p/sable-ion');
    expect(screen.getByRole('link', { name: /Nova/ })).toHaveAttribute('href', '/p/aurelia-nova');
    expect(screen.getByRole('link', { name: 'Skip to products' })).toHaveAttribute('href', '#product-grid');

    const urls = vi.mocked(apiFetch).mock.calls.map(([path]) => String(path));
    expect(urls.every((url) => url === '/api/catalog/home' || url.startsWith('/api/catalog/home?'))).toBe(true);
  });

  it('shows a short empty message and Shop link when home has no hero, blocks, or featured', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ hero: null, blocks: [], featured: [] });
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Nothing to show yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/products');
  });

  it('retries when home fails with a non-404 error', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(500, 'INTERNAL', 'Request failed'));
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
