import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ProductStatus, adminProductListResponseSchema, type AdminProductListResponse } from '@audio-commerce/shared';
import { apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';
import { Button } from '../components/Button.js';
import { Input } from '../components/Input.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const PAGE_SIZE = 20;

export default function AdminProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');
  const status = searchParams.get('status') ?? '';
  const q = searchParams.get('q') ?? '';
  const [qDraft, setQDraft] = useState(q);
  const [data, setData] = useState<AdminProductListResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function load() {
      setError(null);
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (status) params.set('status', status);
      if (q) params.set('q', q);
      try {
        const result = parseCatalog(
          adminProductListResponseSchema,
          await apiFetch(`/api/admin/products?${params.toString()}`, { signal: ac.signal }),
        );
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error('Request failed'));
      }
    }

    void load();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [page, status, q, retryKey]);

  function updateParam(key: string, value: string, resetPage = true) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (resetPage) next.delete('page');
    setSearchParams(next);
  }

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault();
    updateParam('q', qDraft.trim());
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">Products</h1>
        <Link to="/admin/products/new">
          <Button>New product</Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <form onSubmit={handleSearchSubmit} className="flex items-end gap-2">
          <Input
            id="q"
            label="Search"
            value={qDraft}
            placeholder="Name or SKU"
            onChange={(e) => setQDraft(e.target.value)}
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-sm font-medium text-ink">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => updateParam('status', e.target.value)}
            className="rounded-sm border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">All</option>
            <option value={ProductStatus.DRAFT}>Draft</option>
            <option value={ProductStatus.ACTIVE}>Active</option>
            <option value={ProductStatus.ARCHIVED}>Archived</option>
          </select>
        </div>
      </div>

      {error && (
        <ErrorState
          title="Unable to load products"
          description={error.message}
          onRetry={() => setRetryKey((key) => key + 1)}
        />
      )}

      {!error && !data && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {!error && data && data.items.length === 0 && (
        <EmptyState
          title="No products found"
          description="Try a different search or filter, or create a new product."
        />
      )}

      {!error && data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Price</th>
                  <th className="px-4 py-2 font-medium">Stock</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((product) => (
                  <tr key={product.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">
                      <Link to={`/admin/products/${product.id}`} className="text-ink underline">
                        {product.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-ink-muted">{product.category.name}</td>
                    <td className="px-4 py-2 text-ink-muted">{product.status}</td>
                    <td className="px-4 py-2 text-ink">{inr.format(Number(product.basePrice))}</td>
                    <td className={`px-4 py-2 ${product.lowStock ? 'text-danger' : 'text-ink-muted'}`}>
                      {product.totalStock}
                      {product.lowStock ? ' (low)' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-ink-muted">
            <span>
              Page {data.meta.page} of {Math.max(1, data.meta.totalPages)} ({data.meta.total} total)
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => updateParam('page', String(page - 1), false)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={page >= data.meta.totalPages}
                onClick={() => updateParam('page', String(page + 1), false)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
