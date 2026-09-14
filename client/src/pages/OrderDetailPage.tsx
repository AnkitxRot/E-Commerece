import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { orderResponseSchema, type OrderDto } from '@audio-commerce/shared';
import { ApiError, apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';
import { Breadcrumbs } from '../components/Breadcrumbs.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

const STATUS_LABEL: Record<OrderDto['status'], string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const confirmed = searchParams.get('confirmed') === '1';
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function load() {
      if (!orderId) return;
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const data = parseCatalog(orderResponseSchema, await apiFetch(`/api/orders/${orderId}`, { signal: ac.signal }));
        if (cancelled) return;
        setOrder(data.order);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
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
  }, [orderId, retryKey]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <ErrorState title="Order not found" description="This order does not exist or does not belong to you." />
        <p className="mt-4 text-center">
          <Link to="/account/orders" className="text-sm text-ink underline">
            View order history
          </Link>
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <ErrorState
          title="Unable to load order"
          description={error.message}
          onRetry={() => setRetryKey((n) => n + 1)}
        />
      </div>
    );
  }

  if (loading || !order) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Breadcrumbs items={[{ label: 'Order history', href: '/account/orders' }, { label: `Order ${order.id.slice(0, 8)}` }]} />

      {confirmed ? (
        <div className="mb-6 rounded-lg border border-success/30 bg-success/10 px-5 py-4">
          <h1 className="text-xl font-semibold text-ink">Thank you — your order is confirmed</h1>
          <p className="mt-1 text-sm text-ink-muted">
            This is a demo storefront, so no real payment was processed, but your order has been recorded.
          </p>
        </div>
      ) : (
        <h1 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">Order details</h1>
      )}

      <div className="rounded-lg border border-border p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-muted">Order #{order.id.slice(0, 8)}</p>
          <span className="rounded-sm bg-surface px-2 py-1 text-xs font-medium text-ink">{STATUS_LABEL[order.status]}</span>
        </div>
        <p className="mt-1 text-sm text-ink-muted">Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>

        <ul className="mt-5 flex flex-col gap-4 border-t border-border pt-4">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 text-sm">
              <div>
                {item.productSlug ? (
                  <Link to={`/p/${item.productSlug}`} className="font-medium text-ink hover:underline">
                    {item.productName}
                  </Link>
                ) : (
                  <span className="font-medium text-ink">{item.productName}</span>
                )}
                <p className="text-ink-muted">
                  {item.variantSku} × {item.qty}
                </p>
              </div>
              <span className="whitespace-nowrap text-ink">{inr.format(Number(item.lineTotal))}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 flex flex-col gap-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd className="text-ink">{inr.format(Number(order.subtotal))}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Shipping</dt>
            <dd className="text-ink">{Number(order.shippingTotal) === 0 ? 'Free' : inr.format(Number(order.shippingTotal))}</dd>
          </div>
          {order.couponCode ? (
            <div className="flex justify-between">
              <dt className="text-ink-muted">Coupon ({order.couponCode})</dt>
              <dd className="text-success">−{inr.format(Number(order.discountTotal))}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-border pt-2 text-base font-medium">
            <dt className="text-ink">Total</dt>
            <dd className="text-ink">{inr.format(Number(order.grandTotal))}</dd>
          </div>
        </dl>

        <div className="mt-5 border-t border-border pt-4 text-sm">
          <h2 className="font-medium text-ink">Shipping to</h2>
          <address className="mt-1 not-italic text-ink-muted">
            {order.shippingAddress.fullName}
            <br />
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? (
              <>
                <br />
                {order.shippingAddress.line2}
              </>
            ) : null}
            <br />
            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
            <br />
            {order.shippingAddress.country}
          </address>
        </div>
      </div>

      <p className="mt-6 text-center">
        <Link to="/products" className="text-sm text-ink underline">
          Continue shopping
        </Link>
      </p>
    </div>
  );
}
