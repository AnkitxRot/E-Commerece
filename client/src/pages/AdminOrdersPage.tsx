import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { OrderStatus, adminOrderListResponseSchema, type AdminOrderListResponse } from '@audio-commerce/shared';
import { apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';
import { Button } from '../components/Button.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const PAGE_SIZE = 20;
const STATUS_OPTIONS = Object.values(OrderStatus);

export default function AdminOrdersPage() {
  useDocumentTitle('Orders');
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');
  const status = searchParams.get('status') ?? '';
  const [data, setData] = useState<AdminOrderListResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function load() {
      setError(null);
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (status) params.set('status', status);
      try {
        const result = parseCatalog(
          adminOrderListResponseSchema,
          await apiFetch(`/api/admin/orders?${params.toString()}`, { signal: ac.signal }),
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
  }, [page, status, retryKey]);

  function updateParam(key: string, value: string, resetPage = true) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (resetPage) next.delete('page');
    setSearchParams(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">Orders</h1>

      <div className="flex flex-col gap-1 sm:w-64">
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
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <ErrorState
          title="Unable to load orders"
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
        <EmptyState title="No orders found" description="Try a different status filter." />
      )}

      {!error && data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="px-4 py-2 font-medium">Order</th>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Items</th>
                  <th className="px-4 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">
                      <Link to={`/admin/orders/${order.id}`} className="text-ink underline">
                        {order.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-ink-muted">{order.customerEmail}</td>
                    <td className="px-4 py-2 text-ink-muted">{order.status}</td>
                    <td className="px-4 py-2 text-ink-muted">{order.itemCount}</td>
                    <td className="px-4 py-2 text-ink">{inr.format(Number(order.grandTotal))}</td>
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
