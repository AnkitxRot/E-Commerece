import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { productDetailResponseSchema, type ProductDetailDto } from '@audio-commerce/shared';
import { ApiError, apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';
import { selectVariantSku } from '../lib/selectVariant.js';
import { useAuth } from '../context/AuthContext.js';
import { useCart } from '../context/CartContext.js';
import { useToast } from '../context/ToastContext.js';
import { ImageGallery } from '../components/catalog/ImageGallery.js';
import { Price } from '../components/catalog/Price.js';
import { VariantPicker } from '../components/catalog/VariantPicker.js';
import { RatingStars } from '../components/RatingStars.js';
import { ReviewForm } from '../components/reviews/ReviewForm.js';
import { QuantityStepper } from '../components/QuantityStepper.js';
import { SpecsTable } from '../components/catalog/SpecsTable.js';
import { Breadcrumbs } from '../components/Breadcrumbs.js';
import { ProductGrid } from '../components/catalog/ProductGrid.js';
import { Button } from '../components/Button.js';
import { WishlistButton } from '../components/WishlistButton.js';
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

function deliveryEstimate(inStock: boolean): string {
  return inStock ? 'Delivery in 3-5 business days' : 'Currently unavailable for delivery';
}

export default function ProductDetailPage() {
  const { productSlug } = useParams<{ productSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { show } = useToast();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [product, setProduct] = useState<ProductDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [qty, setQty] = useState(1);
  const [pending, setPending] = useState<'cart' | 'buy' | null>(null);

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
    setQty(1);
  }, [selectedSku]);

  useEffect(() => {
    if (!product) return;
    document.title = product.seoTitle ?? product.name;
    setMetaDescription(product.seoDescription);
    headingRef.current?.focus();
    return () => setMetaDescription(null);
  }, [product]);

  async function handleAddToCart() {
    if (!selected) return;
    if (!user) {
      navigate('/login');
      return;
    }
    setPending('cart');
    try {
      await addItem(selected.id, qty);
      show(`Added ${qty} to your cart`, 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not add this item to your cart', 'error');
    } finally {
      setPending(null);
    }
  }

  async function handleBuyNow() {
    if (!selected) return;
    if (!user) {
      navigate('/login');
      return;
    }
    setPending('buy');
    try {
      await addItem(selected.id, qty);
      navigate('/checkout');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not start checkout for this item', 'error');
    } finally {
      setPending(null);
    }
  }

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
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <Breadcrumbs
        items={[
          { label: 'Shop', href: '/products' },
          { label: product.category.name, href: `/c/${product.category.slug}` },
          { label: product.name },
        ]}
      />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <ImageGallery images={product.images} />
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-[-0.01em] text-ink outline-none sm:text-3xl">
              {product.name}
            </h1>
            <WishlistButton slug={product.slug} className="shrink-0 border border-border" />
          </div>
          {product.brand ? <p className="mt-1 text-sm text-ink-muted">{product.brand.name}</p> : null}
          <div className="mt-2">
            <RatingStars rating={product.rating} reviewCount={product.reviewCount} size="md" />
          </div>
          {selected ? (
            <>
              <div className="mt-4">
                <Price from={selected.price} to={selected.price} compareAtPrice={selected.compareAtPrice} />
              </div>
              <p className="mt-1 text-sm text-ink-muted">{deliveryEstimate(selected.inStock)}</p>
              <p className="mt-3 text-sm text-ink">{selected.sku}</p>
              <p className="mt-1 text-sm text-ink-muted">{selected.availableQty} available</p>
              {selected.inStock ? null : <p className="mt-1 text-sm text-ink-muted">Out of stock</p>}
              <div className="mt-6">
                <VariantPicker
                  variants={product.variants}
                  selectedSku={selectedSku}
                  onSelect={(sku) => setSearchParams({ variant: sku }, { replace: true })}
                />
              </div>

              {selected.inStock ? (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <QuantityStepper qty={qty} max={selected.availableQty} onChange={setQty} />
                  <Button
                    type="button"
                    variant="secondary"
                    loading={pending === 'cart'}
                    onClick={() => void handleAddToCart()}
                  >
                    Add to cart
                  </Button>
                  <Button type="button" loading={pending === 'buy'} onClick={() => void handleBuyNow()}>
                    Buy now
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState
              title="This product is unavailable"
              description="No variants are offered for this product."
            />
          )}
          <p className="mt-6 text-ink-muted">{product.description}</p>
          <details className="mt-6 rounded-md border border-border p-4">
            <summary className="cursor-pointer text-sm font-medium text-ink">Shipping and returns</summary>
            <div className="mt-3 space-y-2 text-sm text-ink-muted">
              <p>Free shipping on orders over ₹999. Standard orders arrive in 3-5 business days.</p>
              <p>Not the right fit? Return it within 7 days of delivery for a full refund.</p>
            </div>
          </details>
          <ContinueBrowsing />
        </div>
      </div>

      {Object.keys(product.specs).length > 0 ? (
        <section className="mt-16 max-w-2xl">
          <h2 className="mb-4 text-xl font-semibold tracking-[-0.01em] text-ink">Specifications</h2>
          <SpecsTable specs={product.specs} />
        </section>
      ) : null}

      <section className="mt-16 max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold tracking-[-0.01em] text-ink">Customer reviews</h2>
        {product.reviews.length > 0 ? (
          <ul className="flex flex-col gap-5">
            {product.reviews.map((review) => (
              <li key={review.id} className="border-b border-border pb-5 last:border-0">
                <RatingStars rating={review.rating} reviewCount={1} />
                <p className="mt-2 text-sm text-ink">{review.body}</p>
                <p className="mt-1 text-xs text-ink-muted">{review.authorName}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">No reviews yet.</p>
        )}
        <div className="mt-8 border-t border-border pt-6">
          <h3 className="mb-3 text-base font-semibold text-ink">Write a review</h3>
          <ReviewForm productSlug={product.slug} />
        </div>
      </section>

      {product.relatedProducts.length > 0 ? (
        <section className="mt-16">
          <h2 className="mb-6 text-xl font-semibold tracking-[-0.01em] text-ink">You may also like</h2>
          <ProductGrid products={product.relatedProducts} id="related-products-grid" />
        </section>
      ) : null}
    </div>
  );
}
