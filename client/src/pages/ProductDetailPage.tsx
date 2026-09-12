import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { productDetailResponseSchema, type ProductDetailDto } from '@audio-commerce/shared';
import { ApiError, apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';
import { selectVariantSku } from '../lib/selectVariant.js';
import { ImageGallery } from '../components/catalog/ImageGallery.js';
import { Price } from '../components/catalog/Price.js';
import { VariantPicker } from '../components/catalog/VariantPicker.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';

function isAbort(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

function setMetaDescription(content: string | null) {
  const existing = document.querySelector('meta[name="description"]');
  if (!content) {
    existing?.remove();
    return;
  }
  if (existing) {
    existing.setAttribute('content', content);
    return;
  }
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'description');
  meta.setAttribute('content', content);
  document.head.appendChild(meta);
}

function ContinueBrowsing() {
  return (
    <p className="mt-4">
      <Link to="/products" className="text-sm text-ink underline">
        Continue browsing
      </Link>
    </p>
  );
}

export default function ProductDetailPage() {
  const { productSlug } = useParams<{ productSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [product, setProduct] = useState<ProductDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function load() {
      if (!productSlug) return;
      setLoading(true);
      setError(null);
      setNotFound(false);
      setProduct(null);
      try {
        const data = parseCatalog(
          productDetailResponseSchema,
          await apiFetch(`/api/catalog/products/${productSlug}`, { signal: ac.signal }),
        );
        if (cancelled || ac.signal.aborted) return;
        setProduct(data.product);
        setLoading(false);
      } catch (err) {
        if (cancelled || ac.signal.aborted || isAbort(err)) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setError(err instanceof Error ? err : new Error('Request failed'));
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [productSlug, retryKey]);

  const requested = searchParams.get('variant');
  const selectedSku = product ? selectVariantSku(product, requested) : null;
  const selected = product?.variants.find((variant) => variant.sku === selectedSku) ?? null;

  useEffect(() => {
    if (!product) return;
    if (selectedSku && selectedSku !== requested) {
      setSearchParams({ variant: selectedSku }, { replace: true });
    } else if (!selectedSku && requested) {
      setSearchParams({}, { replace: true });
    }
  }, [product, requested, selectedSku, setSearchParams]);

  useEffect(() => {
    if (!product) return;
    document.title = product.seoTitle ?? product.name;
    setMetaDescription(product.seoDescription);
    headingRef.current?.focus();
    return () => setMetaDescription(null);
  }, [product]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <ErrorState
          title="Product not found"
          description="This product does not exist or is no longer available."
        />
        <ContinueBrowsing />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <ErrorState
          title="Unable to load product"
          description={error.message}
          onRetry={() => setRetryKey((n) => n + 1)}
        />
        <ContinueBrowsing />
      </div>
    );
  }

  if (loading || !product) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2" aria-busy="true">
          <Skeleton className="aspect-square w-full" />
          <div>
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="mt-4 h-4 w-1/3" />
            <Skeleton className="mt-6 h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <ImageGallery images={product.images} />
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold text-ink outline-none">
            {product.name}
          </h1>
          {product.brand ? <p className="mt-1 text-sm text-ink-muted">{product.brand.name}</p> : null}
          {selected ? (
            <>
              <div className="mt-4">
                <Price from={selected.price} to={selected.price} />
              </div>
              <p className="mt-2 text-sm text-ink">{selected.sku}</p>
              <p className="mt-2 text-sm text-ink-muted">{selected.availableQty} available</p>
              {selected.inStock ? null : <p className="mt-1 text-sm text-ink-muted">Out of stock</p>}
              <div className="mt-6">
                <VariantPicker
                  variants={product.variants}
                  selectedSku={selectedSku}
                  onSelect={(sku) => setSearchParams({ variant: sku }, { replace: true })}
                />
              </div>
            </>
          ) : (
            <EmptyState
              title="This product is unavailable"
              description="No variants are offered for this product."
            />
          )}
          <p className="mt-6 text-ink-muted">{product.description}</p>
          <ContinueBrowsing />
        </div>
      </div>
    </div>
  );
}
