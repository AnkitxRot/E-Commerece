import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { orderResponseSchema, shippingAddressInputSchema, type ShippingAddressInput } from '@audio-commerce/shared';
import { useCart } from '../context/CartContext.js';
import { ApiError, apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';
import { Button } from '../components/Button.js';
import { Input } from '../components/Input.js';
import { Breadcrumbs } from '../components/Breadcrumbs.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const FREE_SHIPPING_THRESHOLD = 999;
const FLAT_SHIPPING_FEE = 79;

const EMPTY_ADDRESS: ShippingAddressInput = {
  fullName: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'India',
  phone: '',
};

export default function CheckoutPage() {
  const { cart, loading, error, refresh } = useCart();
  const navigate = useNavigate();
  const [address, setAddress] = useState<ShippingAddressInput>(EMPTY_ADDRESS);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ShippingAddressInput, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof ShippingAddressInput>(key: K, value: string) {
    setAddress((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setServerError(null);

    const input = { ...address, line2: address.line2?.trim() ? address.line2 : undefined };
    const result = shippingAddressInputSchema.safeParse(input);
    if (!result.success) {
      const errors: Partial<Record<keyof ShippingAddressInput, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof ShippingAddressInput | undefined;
        if (key && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const data = parseCatalog(
        orderResponseSchema,
        await apiFetch('/api/orders', {
          method: 'POST',
          body: JSON.stringify({ shippingAddress: result.data }),
        }),
      );
      navigate(`/orders/${data.order.id}?confirmed=1`);
      void refresh();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Unable to place your order right now.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !cart) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="mt-6 h-64 w-full" />
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

  if (!cart || cart.items.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  const subtotal = Number(cart.subtotal);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_FEE;
  const total = subtotal + shipping;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <Breadcrumbs items={[{ label: 'Cart', href: '/cart' }, { label: 'Checkout' }]} />
      <h1 className="mb-2 text-2xl font-semibold tracking-[-0.01em] text-ink">Checkout</h1>
      <p className="mb-6 rounded-md border border-border bg-surface px-4 py-2 text-sm text-ink-muted">
        Demo checkout — no real payment is processed.
      </p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 lg:col-span-2">
          <h2 className="text-lg font-semibold text-ink">Shipping address</h2>
          <Input
            id="fullName"
            label="Full name"
            value={address.fullName}
            error={fieldErrors.fullName}
            onChange={(e) => set('fullName', e.target.value)}
          />
          <Input
            id="line1"
            label="Address line 1"
            value={address.line1}
            error={fieldErrors.line1}
            onChange={(e) => set('line1', e.target.value)}
          />
          <Input
            id="line2"
            label="Address line 2 (optional)"
            value={address.line2 ?? ''}
            error={fieldErrors.line2}
            onChange={(e) => set('line2', e.target.value)}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="city"
              label="City"
              value={address.city}
              error={fieldErrors.city}
              onChange={(e) => set('city', e.target.value)}
            />
            <Input
              id="state"
              label="State"
              value={address.state}
              error={fieldErrors.state}
              onChange={(e) => set('state', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="postalCode"
              label="Postal code"
              value={address.postalCode}
              error={fieldErrors.postalCode}
              onChange={(e) => set('postalCode', e.target.value)}
            />
            <Input
              id="country"
              label="Country"
              value={address.country}
              error={fieldErrors.country}
              onChange={(e) => set('country', e.target.value)}
            />
          </div>
          <Input
            id="phone"
            label="Phone"
            type="tel"
            value={address.phone}
            error={fieldErrors.phone}
            onChange={(e) => set('phone', e.target.value)}
          />

          {serverError ? (
            <p role="alert" className="text-sm text-danger">
              {serverError}
            </p>
          ) : null}

          <Button type="submit" loading={submitting} className="mt-2">
            Place order
          </Button>
        </form>

        <aside className="h-fit rounded-lg border border-border p-5">
          <h2 className="text-lg font-semibold text-ink">Order summary</h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm">
            {cart.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-2">
                <span className="text-ink-muted">
                  {item.productName} × {item.qty}
                </span>
                <span className="text-ink">{inr.format(Number(item.lineTotal))}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 flex flex-col gap-2 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Subtotal</dt>
              <dd className="text-ink">{inr.format(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Shipping</dt>
              <dd className="text-ink">{shipping === 0 ? 'Free' : inr.format(shipping)}</dd>
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-2 text-base font-medium">
              <dt className="text-ink">Total</dt>
              <dd className="text-ink">{inr.format(total)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-center">
            <Link to="/cart" className="text-sm text-ink underline">
              Back to cart
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
