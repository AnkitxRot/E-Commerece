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
      className="inline-flex min-h-[44px] items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white duration-snap"
    >
      {label ?? 'Shop'}
    </Link>
  );
}

function Hero({ hero, headingRef }: { hero: HeroContent; headingRef: RefObject<HTMLHeadingElement> }) {
  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {hero.imageUrl ? (
        <img
          src={hero.imageUrl}
          alt={hero.title}
          width={1600}
          height={900}
          decoding="async"
          className="w-full rounded-md object-cover"
          {...({ fetchpriority: 'high' } as { fetchpriority: 'high' })}
        />
      ) : null}
      <div>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold text-ink outline-none">
          {hero.title}
        </h1>
        {hero.subtitle ? <p className="mt-3 text-ink-muted">{hero.subtitle}</p> : null}
        {hero.ctaHref ? (
          <p className="mt-6">
            <HeroCta href={hero.ctaHref} label={hero.ctaLabel} />
          </p>
        ) : null}
      </div>
    </section>
  );
}

function BannerBlock({ payload }: { payload: BannerPayload }) {
  return (
    <section className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
      {payload.imageUrl ? (
        <img
          src={payload.imageUrl}
          alt={payload.title}
          width={1600}
          height={900}
          loading="lazy"
          decoding="async"
          className="w-full rounded-md object-cover"
        />
      ) : null}
      <div>
        <h2 className="text-xl font-semibold text-ink">{payload.title}</h2>
        {payload.subtitle ? <p className="mt-2 text-ink-muted">{payload.subtitle}</p> : null}
        {payload.ctaHref ? (
          <p className="mt-4">
            <HeroCta href={payload.ctaHref} label={payload.ctaLabel} />
          </p>
        ) : null}
      </div>
    </section>
  );
}

function AnnouncementBlock({ payload }: { payload: AnnouncementPayload }) {
  return (
    <p className="mt-8 rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink">
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
        <section className="mt-12">
          <h2 className="mb-6 text-xl font-semibold text-ink">{block.payload.title}</h2>
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
    document.title = home.hero?.title ?? 'Aurelia Audio';
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2" aria-busy="true">
          <Skeleton className="aspect-video w-full" />
          <div>
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="mt-4 h-4 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const empty = !home.hero && home.blocks.length === 0 && home.featured.length === 0;
  const firstCollection = home.blocks.find(
    (block) => block.type === ContentBlockType.FEATURED_COLLECTION && block.products.length > 0,
  );
  const listingId = home.featured.length > 0 || firstCollection ? 'product-grid' : undefined;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
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
          Aurelia Audio
        </h1>
      )}
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
        <section className="mt-12">
          <ProductGrid products={home.featured} />
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
