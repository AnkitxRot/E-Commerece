import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminDashboardDtoSchema, type AdminDashboardDto } from '@audio-commerce/shared';
import { apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminDashboardDto | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        const dashboard = parseCatalog(
          adminDashboardDtoSchema,
          await apiFetch('/api/admin/overview', { signal: ac.signal }),
        );
        if (!cancelled) setData(dashboard);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error('Request failed'));
      }
    }

    void load();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [retryKey]);

  if (error) {
    return (
      <ErrorState
        title="Unable to load the dashboard"
        description={error.message}
        onRetry={() => setRetryKey((key) => key + 1)}
      />
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const stats: { label: string; value: string | number; hint?: string }[] = [
    { label: 'Products', value: data.productCount, hint: `${data.activeProductCount} active` },
    { label: 'Orders', value: data.orderCount },
    { label: 'Revenue', value: inr.format(Number(data.revenueTotal)) },
    {
      label: 'Low stock',
      value: data.lowStockCount,
      hint: data.lowStockCount > 0 ? 'variants at or under threshold' : undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted">A snapshot of the store&apos;s current state.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border p-4">
            <p className="text-sm text-ink-muted">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{stat.value}</p>
            {stat.hint && <p className="mt-1 text-xs text-ink-muted">{stat.hint}</p>}
          </div>
        ))}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Recent orders</h2>
          <Link to="/admin/orders" className="text-sm text-ink underline">
            View all
          </Link>
        </div>
        {data.recentOrders.length === 0 ? (
          <p className="text-sm text-ink-muted">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="px-4 py-2 font-medium">Order</th>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">
                      <Link to={`/admin/orders/${order.id}`} className="text-ink underline">
                        {order.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-ink-muted">{order.customerEmail}</td>
                    <td className="px-4 py-2 text-ink-muted">{order.status}</td>
                    <td className="px-4 py-2 text-ink">{inr.format(Number(order.grandTotal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
