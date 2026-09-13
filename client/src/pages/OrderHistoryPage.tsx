import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderListResponseSchema, type OrderDto } from '@audio-commerce/shared';
import { apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';
import { Breadcrumbs } from '../components/Breadcrumbs.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<OrderDto[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        const data = parseCatalog(orderListResponseSchema, await apiFetch('/api/orders', { signal: ac.signal }));
        if (cancelled) return;
        setOrders(data.orders);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('Request failed'));
      }
    }

    void load();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [retryKey]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Breadcrumbs items={[{ label: 'Account', href: '/account' }, { label: 'Order history' }]} />
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">Order history</h1>

      {error ? (
        <ErrorState title="Unable to load orders" description={error.message} onRetry={() => setRetryKey((n) => n + 1)} />
      ) : !orders ? (
        <div aria-busy="true">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="mt-4 h-20 w-full" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Your past orders will show up here."
          action={
            <Link to="/products" className="text-sm text-ink underline">
              Start shopping
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                to={`/orders/${order.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-4 duration-snap hover:border-ink"
              >
                <div>
                  <p className="font-medium text-ink">Order #{order.id.slice(0, 8)}</p>
                  <p className="text-sm text-ink-muted">
                    {new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })} · {order.items.length}{' '}
                    item{order.items.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-ink">{inr.format(Number(order.grandTotal))}</p>
                  <p className="text-sm text-ink-muted">{order.status}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
