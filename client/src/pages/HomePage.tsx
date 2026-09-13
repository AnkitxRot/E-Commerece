import { useEffect, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import {
  ContentBlockType,
  homeResponseSchema,
  type AnnouncementPayload,
  type BannerPayload,
  type HeroContent,
  type HomeBlockDto,
  type HomeResponse,
} from '@audio-commerce/shared';
import { apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';
import { ProductGrid } from '../components/catalog/ProductGrid.js';
import { CategoryTile } from '../components/catalog/CategoryTile.js';
import { TrustBadges } from '../components/TrustBadges.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';

function isAbort(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

function HeroCta({ href, label }: { href: string; label?: string }) {
  return (
    <Link
      to={href}
      className="inline-flex min-h-[44px] items-center rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink duration-snap"
    >
      {label ?? 'Shop'}
    </Link>
  );
}

function Hero({ hero, headingRef }: { hero: HeroContent; headingRef: RefObject<HTMLHeadingElement> }) {
  return (
    <section className="relative overflow-hidden rounded-xl">
      {hero.imageUrl ? (
        <img
          src={hero.imageUrl}
          alt=""
          width={1600}
          height={900}
          decoding="async"
          className="aspect-[16/10] w-full object-cover sm:aspect-[16/7]"
          {...({ fetchpriority: 'high' } as { fetchpriority: 'high' })}
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" aria-hidden="true" />
      <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-12">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="max-w-xl text-3xl font-semibold tracking-[-0.02em] text-white outline-none sm:text-5xl"
        >
          {hero.title}
        </h1>
        {hero.subtitle ? <p className="mt-3 max-w-lg text-base text-white/85 sm:text-lg">{hero.subtitle}</p> : null}
        {hero.ctaHref ? <div className="mt-6">{<HeroCta href={hero.ctaHref} label={hero.ctaLabel} />}</div> : null}
      </div>
    </section>
  );
}

function BannerBlock({ payload }: { payload: BannerPayload }) {
  return (
    <section className="mt-16 grid grid-cols-1 items-center gap-8 md:grid-cols-2">
      {payload.imageUrl ? (
        <img
          src={payload.imageUrl}
          alt={payload.title}
          width={1600}
          height={900}
          loading="lazy"
          decoding="async"
          className="w-full rounded-lg object-cover"
        />
      ) : null}
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.01em] text-ink">{payload.title}</h2>
        {payload.subtitle ? <p className="mt-2 text-ink-muted">{payload.subtitle}</p> : null}
        {payload.ctaHref ? (
          <p className="mt-5">
            <HeroCta href={payload.ctaHref} label={payload.ctaLabel} />
          </p>
        ) : null}
      </div>
    </section>
  );
}

function AnnouncementBlock({ payload }: { payload: AnnouncementPayload }) {
  return (
    <p className="mt-8 rounded-md border border-border bg-surface px-4 py-3 text-center text-sm text-ink">
      {payload.href ? (
        <Link to={payload.href} className="underline">
          {payload.message}
        </Link>
      ) : (
        payload.message
      )}
    </p>
  );
}

function HomeBlock({ block, listingId }: { block: HomeBlockDto; listingId?: string }) {
  switch (block.type) {
    case ContentBlockType.BANNER:
      return <BannerBlock payload={block.payload} />;
    case ContentBlockType.ANNOUNCEMENT:
      return <AnnouncementBlock payload={block.payload} />;
    case ContentBlockType.FEATURED_COLLECTION:
      return (
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">{block.payload.title}</h2>
          <ProductGrid products={block.products} id={listingId ?? `collection-${block.id}`} />
        </section>
      );
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

export default function HomePage() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [home, setHome] = useState<HomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = parseCatalog(homeResponseSchema, await apiFetch('/api/catalog/home', { signal: ac.signal }));
        if (cancelled || ac.signal.aborted) return;
        setHome(data);
        setLoading(false);
      } catch (err) {
        if (cancelled || ac.signal.aborted || isAbort(err)) return;
        setError(err instanceof Error ? err : new Error('Request failed'));
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [retryKey]);

  useEffect(() => {
    if (!home) return;
    document.title = home.hero?.title ?? 'Everyday';
    headingRef.current?.focus();
  }, [home]);

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <ErrorState
          title="Unable to load home"
          description={error.message}
          onRetry={() => setRetryKey((n) => n + 1)}
        />
      </div>
    );
  }

  if (loading || !home) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Skeleton className="aspect-[16/7] w-full rounded-xl" />
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const empty =
    !home.hero &&
    home.blocks.length === 0 &&
    home.featured.length === 0 &&
    home.bestSellers.length === 0 &&
    home.newArrivals.length === 0 &&
    home.categories.length === 0;
  const firstCollection = home.blocks.find(
    (block) => block.type === ContentBlockType.FEATURED_COLLECTION && block.products.length > 0,
  );
  const listingId = home.featured.length > 0 || firstCollection ? 'product-grid' : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {listingId ? (
        <a
          href="#product-grid"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to products
        </a>
      ) : null}
      {home.hero ? (
        <Hero hero={home.hero} headingRef={headingRef} />
      ) : (
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold text-ink outline-none">
          Everyday
        </h1>
      )}

      <section className="mt-10">
        <TrustBadges />
      </section>

      {home.categories.length > 0 ? (
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">Shop by category</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {home.categories.map((category) => (
              <CategoryTile key={category.slug} category={category} />
            ))}
          </div>
        </section>
      ) : null}

      {home.blocks.map((block) => (
        <HomeBlock
          key={block.id}
          block={block}
          listingId={
            home.featured.length === 0 && block.id === firstCollection?.id ? listingId : undefined
          }
        />
      ))}

      {home.featured.length > 0 ? (
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">Featured</h2>
          <ProductGrid products={home.featured} id={listingId ?? 'product-grid'} />
        </section>
      ) : null}

      {home.bestSellers.length > 0 ? (
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">Best sellers</h2>
          <ProductGrid products={home.bestSellers} id="best-sellers-grid" />
        </section>
      ) : null}

      {home.newArrivals.length > 0 ? (
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">New arrivals</h2>
          <ProductGrid products={home.newArrivals} id="new-arrivals-grid" />
        </section>
      ) : null}

      {empty ? (
        <EmptyState
          title="Nothing to show yet"
          description="The catalog is empty right now."
          action={
            <Link to="/products" className="text-sm text-ink underline">
              Shop
            </Link>
          }
        />
      ) : null}
    </div>
  );
}
