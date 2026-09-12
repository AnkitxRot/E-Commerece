import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  brandsResponseSchema,
  catalogSortSchema,
  categoryDetailDtoSchema,
  normalizeSearchQuery,
  productListResponseSchema,
  type BrandDto,
  type CatalogSort,
  type CategoryDetailDto,
  type ProductListResponse,
} from '@audio-commerce/shared';
import { ApiError, apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';
import { writeListParams } from '../lib/listUrl.js';
import { FilterBar, type FilterBarValues } from '../components/catalog/FilterBar.js';
import { ProductGrid } from '../components/catalog/ProductGrid.js';
import { Pagination } from '../components/catalog/Pagination.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';
import { Button } from '../components/Button.js';

function isAbort(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

const PRICE_PATTERN = /^\d+(?:\.\d{1,2})?$/;

function readSort(raw: string | null): CatalogSort {
  const parsed = catalogSortSchema.safeParse(raw ?? 'newest');
  return parsed.success ? parsed.data : 'newest';
}

function isCommittableQ(raw: string): boolean {
  const normalized = normalizeSearchQuery(raw);
  return normalized.length === 0 || normalized.length >= 2;
}

function isCommittablePrice(raw: string): boolean {
  return raw === '' || PRICE_PATTERN.test(raw);
}

const LIST_QUERY_KEYS = ['q', 'brand', 'minPrice', 'maxPrice', 'inStock', 'sort', 'page', 'pageSize'] as const;

function listQueryFromParams(searchParams: URLSearchParams, categorySlug?: string): URLSearchParams {
  const qs = new URLSearchParams();
  for (const key of LIST_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (value === null) continue;
    if (key === 'q' && !isCommittableQ(value)) continue;
    if ((key === 'minPrice' || key === 'maxPrice') && !isCommittablePrice(value)) continue;
    qs.set(key, value);
  }
  if (categorySlug) qs.set('category', categorySlug);
  return qs;
}

export default function ProductListPage() {
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [draftQ, setDraftQ] = useState(() => searchParams.get('q') ?? '');
  const [draftMinPrice, setDraftMinPrice] = useState(() => searchParams.get('minPrice') ?? '');
  const [draftMaxPrice, setDraftMaxPrice] = useState(() => searchParams.get('maxPrice') ?? '');
  const [list, setList] = useState<ProductListResponse | null>(null);
  const [brands, setBrands] = useState<BrandDto[]>([]);
  const [category, setCategory] = useState<CategoryDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [categoryNotFound, setCategoryNotFound] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const urlQ = searchParams.get('q') ?? '';
  const urlMinPrice = searchParams.get('minPrice') ?? '';
  const urlMaxPrice = searchParams.get('maxPrice') ?? '';

  useEffect(() => {
    setDraftQ(urlQ);
  }, [urlQ]);

  useEffect(() => {
    setDraftMinPrice(urlMinPrice);
  }, [urlMinPrice]);

  useEffect(() => {
    setDraftMaxPrice(urlMaxPrice);
  }, [urlMaxPrice]);

  useEffect(() => {
    if (draftQ === urlQ || !isCommittableQ(draftQ)) return;
    const timer = window.setTimeout(() => {
      const nextQ = normalizeSearchQuery(draftQ) || undefined;
      setSearchParams((prev) => writeListParams(prev, { q: nextQ }, 'filter'), { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draftQ, urlQ, setSearchParams]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [categorySlug]);

  useEffect(() => {
    document.title = category?.name ?? 'Shop';
  }, [category]);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setCategoryNotFound(false);
      if (!categorySlug) setCategory(null);

      const qs = listQueryFromParams(searchParams, categorySlug);
      const query = qs.toString();
      const productsUrl = `/api/catalog/products${query ? `?${query}` : ''}`;

      const productsP = apiFetch(productsUrl, { signal: ac.signal }).then((data) =>
        parseCatalog(productListResponseSchema, data),
      );
      const brandsP = apiFetch('/api/catalog/brands', { signal: ac.signal }).then((data) =>
        parseCatalog(brandsResponseSchema, data),
      );
      const categoryP = categorySlug
        ? apiFetch(`/api/catalog/categories/${categorySlug}`, { signal: ac.signal }).then((data) =>
            parseCatalog(categoryDetailDtoSchema, data),
          )
        : Promise.resolve(null);

      const [productsResult, brandsResult, categoryResult] = await Promise.allSettled([
        productsP,
        brandsP,
        categoryP,
      ]);

      if (cancelled || ac.signal.aborted) return;

      if (categorySlug && categoryResult.status === 'rejected') {
        const reason = categoryResult.reason;
        if (isAbort(reason)) return;
        if (reason instanceof ApiError && reason.status === 404) {
          setCategoryNotFound(true);
          setCategory(null);
          setList(null);
          setLoading(false);
          return;
        }
        setError(reason instanceof Error ? reason : new Error('Request failed'));
        setLoading(false);
        return;
      }

      if (categoryResult.status === 'fulfilled') setCategory(categoryResult.value);

      if (brandsResult.status === 'rejected') {
        if (isAbort(brandsResult.reason)) return;
        setError(brandsResult.reason instanceof Error ? brandsResult.reason : new Error('Request failed'));
        setLoading(false);
        return;
      }
      setBrands(brandsResult.value.brands);

      if (productsResult.status === 'rejected') {
        if (isAbort(productsResult.reason)) return;
        setError(productsResult.reason instanceof Error ? productsResult.reason : new Error('Request failed'));
        setLoading(false);
        return;
      }

      const data = productsResult.value;
      if (data.meta.totalPages > 0 && data.meta.page > data.meta.totalPages) {
        setSearchParams(
          (prev) => writeListParams(prev, { page: String(data.meta.totalPages) }, 'page'),
          { replace: true },
        );
        return;
      }

      setList(data);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [searchParams, categorySlug, retryKey, setSearchParams]);

  const values: FilterBarValues = {
    q: draftQ,
    brand: searchParams.get('brand') ?? '',
    minPrice: draftMinPrice,
    maxPrice: draftMaxPrice,
    inStock: searchParams.get('inStock') === 'true',
    sort: readSort(searchParams.get('sort')),
  };

  const hasFilters = Boolean(
    searchParams.get('q') ||
      searchParams.get('brand') ||
      searchParams.get('minPrice') ||
      searchParams.get('maxPrice') ||
      searchParams.get('inStock'),
  );

  function onFilterChange(patch: Record<string, string | undefined>) {
    if (Object.keys(patch).length === 1 && 'q' in patch) {
      setDraftQ(patch.q ?? '');
      return;
    }
    if ('minPrice' in patch) {
      const value = patch.minPrice ?? '';
      setDraftMinPrice(value);
      if (!isCommittablePrice(value)) return;
    }
    if ('maxPrice' in patch) {
      const value = patch.maxPrice ?? '';
      setDraftMaxPrice(value);
      if (!isCommittablePrice(value)) return;
    }
    setSearchParams((prev) => writeListParams(prev, patch, 'filter'), { replace: true });
  }

  function onFilterSubmit(next: FilterBarValues) {
    setDraftQ(next.q);
    setDraftMinPrice(next.minPrice);
    setDraftMaxPrice(next.maxPrice);
    const patch: Record<string, string | undefined> = {
      brand: next.brand || undefined,
      inStock: next.inStock ? 'true' : undefined,
      sort: next.sort,
    };
    if (isCommittableQ(next.q)) patch.q = normalizeSearchQuery(next.q) || undefined;
    if (isCommittablePrice(next.minPrice)) patch.minPrice = next.minPrice || undefined;
    if (isCommittablePrice(next.maxPrice)) patch.maxPrice = next.maxPrice || undefined;
    setSearchParams((prev) => writeListParams(prev, patch, 'filter'), { replace: true });
  }

  function onPage(page: number) {
    setSearchParams((prev) => writeListParams(prev, { page: String(page) }, 'page'), { replace: false });
  }

  function clearFilters() {
    setDraftQ('');
    setDraftMinPrice('');
    setDraftMaxPrice('');
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  if (categoryNotFound) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <ErrorState
          title="Category not found"
          description="This category does not exist or is no longer available."
        />
        <p className="mt-4 text-center">
          <Link to="/products" className="text-sm text-ink underline">
            View all products
          </Link>
        </p>
      </div>
    );
  }

  const title = category?.name ?? 'Shop';

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <a
        href="#product-grid"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to products
      </a>
      <h1 ref={headingRef} tabIndex={-1} className="mb-6 text-2xl font-semibold text-ink outline-none">
        {title}
      </h1>
      {category && category.children.length > 0 ? (
        <nav aria-label="Subcategories" className="mb-6 flex flex-wrap gap-4 text-sm">
          {category.children.map((child) => (
            <Link key={child.slug} to={`/c/${child.slug}`} className="inline-flex min-h-[44px] items-center">
              {child.name}
            </Link>
          ))}
        </nav>
      ) : null}
      <FilterBar values={values} brands={brands} onChange={onFilterChange} onSubmit={onFilterSubmit} />
      <div className="mt-6" aria-busy={loading || undefined}>
        {error ? (
          <ErrorState
            title="Unable to load products"
            description={error.message}
            onRetry={() => setRetryKey((n) => n + 1)}
          />
        ) : list && !loading ? (
          <p className="mb-4 text-sm text-ink-muted" aria-live="polite">
            {list.meta.total} products
          </p>
        ) : null}
        {error ? null : loading ? (
          <ul id="product-grid" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <li key={index}>
                <Skeleton className="aspect-square w-full" />
                <Skeleton className="mt-3 h-4 w-2/3" />
                <Skeleton className="mt-2 h-4 w-1/3" />
              </li>
            ))}
          </ul>
        ) : list && list.meta.total === 0 ? (
          <div id="product-grid">
            {hasFilters ? (
              <EmptyState
                title="No matching products"
                description="Try a different search or reset your filters."
                action={
                  <Button type="button" variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState title="No products yet" description="The catalog has no products yet." />
            )}
          </div>
        ) : list ? (
          <>
            <ProductGrid products={list.items} />
            <div className="mt-8">
              <Pagination page={list.meta.page} totalPages={list.meta.totalPages} onPage={onPage} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
