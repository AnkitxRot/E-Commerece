import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CartItemDto } from '@audio-commerce/shared';
import { useCart } from '../context/CartContext.js';
import { useToast } from '../context/ToastContext.js';
import { ApiError } from '../lib/apiClient.js';
import { QuantityStepper } from '../components/QuantityStepper.js';
import { Button } from '../components/Button.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';
import { Breadcrumbs } from '../components/Breadcrumbs.js';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const FREE_SHIPPING_THRESHOLD = 999;
const FLAT_SHIPPING_FEE = 79;

function CartLine({ item }: { item: CartItemDto }) {
  const { updateItemQty, removeItem } = useCart();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  async function changeQty(next: number) {
    setBusy(true);
    try {
      await updateItemQty(item.id, next);
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not update quantity', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await removeItem(item.id);
      show('Removed from cart', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not remove this item', 'error');
      setBusy(false);
    }
  }

  const attrs = Object.entries(item.attributes)
    .map(([, value]) => value)
    .join(', ');

  return (
    <li className="flex gap-4 border-b border-border py-6 last:border-0">
      <Link to={`/p/${item.productSlug}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-md bg-surface">
        {item.thumbnail ? (
          <img src={item.thumbnail.url} alt={item.thumbnail.altText} className="h-full w-full object-cover" />
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <Link to={`/p/${item.productSlug}`} className="font-medium text-ink hover:underline">
            {item.productName}
          </Link>
          {attrs ? <p className="text-sm text-ink-muted">{attrs}</p> : null}
          {!item.inStock ? <p className="mt-1 text-sm text-danger">Out of stock</p> : null}
          {item.inStock && item.qty > item.availableQty ? (
            <p className="mt-1 text-sm text-danger">Only {item.availableQty} left — reduce quantity</p>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <QuantityStepper
            qty={item.qty}
            max={Math.max(item.availableQty, 1)}
            onChange={(next) => void changeQty(next)}
            label={`Quantity for ${item.productName}`}
          />
          <button
            type="button"
            className="text-sm text-ink-muted underline disabled:opacity-50"
            disabled={busy}
            onClick={() => void remove()}
          >
            Remove
          </button>
        </div>
      </div>
      <p className="whitespace-nowrap font-medium text-ink">{inr.format(Number(item.lineTotal))}</p>
    </li>
  );
}

export default function CartPage() {
  const { cart, loading, error, refresh } = useCart();
  const navigate = useNavigate();

  if (loading && !cart) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="mt-6 h-24 w-full" />
        <Skeleton className="mt-4 h-24 w-full" />
      </div>
    );
  }

  if (error && !cart) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <ErrorState title="Unable to load your cart" description={error.message} onRetry={() => void refresh()} />
      </div>
    );
  }

  const items = cart?.items ?? [];
  const subtotal = Number(cart?.subtotal ?? '0');
  const hasBlockingIssue = items.some((item) => !item.inStock || item.qty > item.availableQty);
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_FEE;
  const total = subtotal + shipping;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <Breadcrumbs items={[{ label: 'Shop', href: '/products' }, { label: 'Cart' }]} />
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">Your cart</h1>

      {items.length === 0 ? (
        <EmptyState
          title="Your cart is empty"
          description="Browse the catalog to find something you'll love."
          action={
            <Link to="/products">
              <Button type="button">Continue shopping</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <ul className="lg:col-span-2">
            {items.map((item) => (
              <CartLine key={item.id} item={item} />
            ))}
          </ul>
          <aside className="h-fit rounded-lg border border-border p-5">
            <h2 className="text-lg font-semibold text-ink">Order summary</h2>
            <dl className="mt-4 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Subtotal</dt>
                <dd className="text-ink">{inr.format(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Shipping</dt>
                <dd className="text-ink">{shipping === 0 ? 'Free' : inr.format(shipping)}</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-medium">
                <dt className="text-ink">Total</dt>
                <dd className="text-ink">{inr.format(total)}</dd>
              </div>
            </dl>
            {hasBlockingIssue ? (
              <p className="mt-3 text-sm text-danger">Resolve the stock issues above before checking out.</p>
            ) : null}
            <Button
              type="button"
              className="mt-5 w-full"
              disabled={hasBlockingIssue}
              onClick={() => navigate('/checkout')}
            >
              Proceed to checkout
            </Button>
            <p className="mt-3 text-center">
              <Link to="/products" className="text-sm text-ink underline">
                Continue shopping
              </Link>
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
