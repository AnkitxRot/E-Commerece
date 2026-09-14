import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { OrderStatus, adminOrderResponseSchema, type AdminOrderDetailDto } from '@audio-commerce/shared';
import { ApiError, apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';
import { Button } from '../components/Button.js';
import { Breadcrumbs } from '../components/Breadcrumbs.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

// UX-only convenience — the server independently re-validates every transition via
// ORDER_STATUS_TRANSITIONS in orders.service.ts and is the real enforcement boundary.
const NEXT_STATUS_OPTIONS: Record<string, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<AdminOrderDetailDto | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [nextStatus, setNextStatus] = useState('');
  const [updating, setUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useDocumentTitle(order ? `Order ${order.id.slice(0, 8)}` : 'Order');

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        const data = parseCatalog(
          adminOrderResponseSchema,
          await apiFetch(`/api/admin/orders/${id}`, { signal: ac.signal }),
        );
        if (!cancelled) {
          setOrder(data.order);
          setNextStatus('');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error('Request failed'));
      }
    }

    void load();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [id, retryKey]);

  async function handleUpdateStatus() {
    if (!order || !nextStatus) return;
    setUpdating(true);
    setStatusError(null);
    try {
      const data = parseCatalog(
        adminOrderResponseSchema,
        await apiFetch(`/api/admin/orders/${order.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus }),
        }),
      );
      setOrder(data.order);
      setNextStatus('');
    } catch (err) {
      setStatusError(err instanceof ApiError ? err.message : 'Unable to update this order right now.');
    } finally {
      setUpdating(false);
    }
  }

  if (error) {
    return (
      <ErrorState
        title="Unable to load this order"
        description={error.message}
        onRetry={() => setRetryKey((key) => key + 1)}
      />
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const availableTransitions = NEXT_STATUS_OPTIONS[order.status] ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Orders', href: '/admin/orders' }, { label: order.id.slice(0, 8) }]} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Order {order.id.slice(0, 8)}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {order.customer.name} · {order.customer.email}
          </p>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-sm text-ink">{order.status}</span>
      </div>

      {availableTransitions.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="nextStatus" className="text-sm font-medium text-ink">
              Update status
            </label>
            <select
              id="nextStatus"
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value)}
              className="rounded-sm border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Select next status</option>
              {availableTransitions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <Button disabled={!nextStatus} loading={updating} onClick={() => void handleUpdateStatus()}>
            Apply
          </Button>
          {statusError && (
            <p role="alert" className="w-full text-sm text-danger">
              {statusError}
            </p>
          )}
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold text-ink">Items</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-muted">
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">SKU</th>
                <th className="px-4 py-2 font-medium">Qty</th>
                <th className="px-4 py-2 font-medium">Unit price</th>
                <th className="px-4 py-2 font-medium">Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-ink">
                    {item.productSlug ? (
                      <Link to={`/p/${item.productSlug}`} className="underline">
                        {item.productName}
                      </Link>
                    ) : (
                      item.productName
                    )}
                  </td>
                  <td className="px-4 py-2 text-ink-muted">{item.variantSku}</td>
                  <td className="px-4 py-2 text-ink-muted">{item.qty}</td>
                  <td className="px-4 py-2 text-ink-muted">{inr.format(Number(item.unitPrice))}</td>
                  <td className="px-4 py-2 text-ink">{inr.format(Number(item.lineTotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <h2 className="mb-2 text-lg font-semibold text-ink">Totals</h2>
          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Subtotal</dt>
              <dd className="text-ink">{inr.format(Number(order.subtotal))}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Shipping</dt>
              <dd className="text-ink">{inr.format(Number(order.shippingTotal))}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-1 font-medium">
              <dt className="text-ink">Total</dt>
              <dd className="text-ink">{inr.format(Number(order.grandTotal))}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-lg border border-border p-4">
          <h2 className="mb-2 text-lg font-semibold text-ink">Shipping address</h2>
          <p className="text-sm text-ink-muted">
            {order.shippingAddress.fullName}
            <br />
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? <>, {order.shippingAddress.line2}</> : null}
            <br />
            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
            <br />
            {order.shippingAddress.country}
          </p>
        </div>
      </div>
    </div>
  );
}
