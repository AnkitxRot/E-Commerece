import { useEffect, useState, type FormEvent } from 'react';
import {
  adminCouponListResponseSchema,
  adminCouponResponseSchema,
  createCouponInputSchema,
  updateCouponInputSchema,
  CouponType,
  type AdminCouponDto,
} from '@audio-commerce/shared';
import { ApiError, apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';
import { useToast } from '../context/ToastContext.js';
import { Button } from '../components/Button.js';
import { Input } from '../components/Input.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

function toEndOfDayIso(dateInput: string): string {
  return new Date(`${dateInput}T23:59:59.999`).toISOString();
}

function toDateInputValue(isoString: string): string {
  return isoString.slice(0, 10);
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<AdminCouponDto[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const { show } = useToast();

  const [code, setCode] = useState('');
  const [type, setType] = useState<AdminCouponDto['type']>(CouponType.PERCENT);
  const [value, setValue] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editExpiresAt, setEditExpiresAt] = useState('');
  const [editUsageLimit, setEditUsageLimit] = useState('');
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});
  const [editServerError, setEditServerError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        const result = parseCatalog(
          adminCouponListResponseSchema,
          await apiFetch('/api/admin/coupons', { signal: ac.signal }),
        );
        if (!cancelled) setCoupons(result.coupons);
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

  async function handleCreateSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setServerError(null);

    const result = createCouponInputSchema.safeParse({
      code,
      type,
      value,
      expiresAt: expiresAt ? toEndOfDayIso(expiresAt) : expiresAt,
      usageLimit: usageLimit.trim() === '' ? null : Number(usageLimit),
    });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) errors[issue.path.join('.') || 'form'] = issue.message;
      setFieldErrors(errors);
      return;
    }

    setCreating(true);
    try {
      const data = await apiFetch('/api/admin/coupons', { method: 'POST', body: JSON.stringify(result.data) });
      const created = parseCatalog(adminCouponResponseSchema, data).coupon;
      setCoupons((prev) => (prev ? [created, ...prev] : [created]));
      setCode('');
      setValue('');
      setExpiresAt('');
      setUsageLimit('');
      show('Coupon created', 'success');
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Unable to create this coupon right now.');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(coupon: AdminCouponDto) {
    setEditingId(coupon.id);
    setEditValue(coupon.value);
    setEditExpiresAt(toDateInputValue(coupon.expiresAt));
    setEditUsageLimit(coupon.usageLimit === null ? '' : String(coupon.usageLimit));
    setEditFieldErrors({});
    setEditServerError(null);
  }

  async function handleEditSubmit(event: FormEvent, id: string) {
    event.preventDefault();
    setEditFieldErrors({});
    setEditServerError(null);

    const result = updateCouponInputSchema.safeParse({
      value: editValue,
      expiresAt: editExpiresAt ? toEndOfDayIso(editExpiresAt) : editExpiresAt,
      usageLimit: editUsageLimit.trim() === '' ? null : Number(editUsageLimit),
    });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) errors[issue.path.join('.') || 'form'] = issue.message;
      setEditFieldErrors(errors);
      return;
    }

    setEditSaving(true);
    try {
      const data = await apiFetch(`/api/admin/coupons/${id}`, { method: 'PATCH', body: JSON.stringify(result.data) });
      const updated = parseCatalog(adminCouponResponseSchema, data).coupon;
      setCoupons((prev) => (prev ? prev.map((c) => (c.id === id ? updated : c)) : prev));
      setEditingId(null);
      show('Coupon updated', 'success');
    } catch (err) {
      setEditServerError(err instanceof ApiError ? err.message : 'Unable to save this coupon right now.');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleToggleActive(coupon: AdminCouponDto) {
    setActingId(coupon.id);
    try {
      const data = await apiFetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !coupon.active }),
      });
      const updated = parseCatalog(adminCouponResponseSchema, data).coupon;
      setCoupons((prev) => (prev ? prev.map((c) => (c.id === coupon.id ? updated : c)) : prev));
      show(updated.active ? 'Coupon activated' : 'Coupon deactivated', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not update this coupon', 'error');
    } finally {
      setActingId(null);
    }
  }

  async function handleDelete(coupon: AdminCouponDto) {
    setActingId(coupon.id);
    try {
      await apiFetch(`/api/admin/coupons/${coupon.id}`, { method: 'DELETE' });
      setCoupons((prev) => (prev ? prev.filter((c) => c.id !== coupon.id) : prev));
      show('Coupon deleted', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not delete this coupon', 'error');
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">Coupons</h1>

      <form onSubmit={handleCreateSubmit} noValidate className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-ink">New coupon</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            id="code"
            label="Code"
            value={code}
            error={fieldErrors.code}
            onChange={(e) => setCode(e.target.value)}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="type" className="text-sm font-medium text-ink">
              Type
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as AdminCouponDto['type'])}
              className="rounded-sm border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value={CouponType.PERCENT}>Percent off</option>
              <option value={CouponType.FIXED}>Fixed amount off</option>
            </select>
          </div>
          <Input
            id="value"
            label={type === CouponType.PERCENT ? 'Percent (0-100)' : 'Amount (₹)'}
            value={value}
            error={fieldErrors.value}
            placeholder="10.00"
            onChange={(e) => setValue(e.target.value)}
          />
          <Input
            id="usageLimit"
            label="Usage limit (blank = unlimited)"
            type="number"
            min={1}
            value={usageLimit}
            error={fieldErrors.usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
          />
          <Input
            id="expiresAt"
            label="Expires on"
            type="date"
            value={expiresAt}
            error={fieldErrors.expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
        {serverError && (
          <p role="alert" className="text-sm text-danger">
            {serverError}
          </p>
        )}
        <Button type="submit" loading={creating} className="self-start">
          Create coupon
        </Button>
      </form>

      {error && (
        <ErrorState
          title="Unable to load coupons"
          description={error.message}
          onRetry={() => setRetryKey((key) => key + 1)}
        />
      )}

      {!error && !coupons && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {!error && coupons && coupons.length === 0 && (
        <EmptyState title="No coupons yet" description="Create your first coupon above." />
      )}

      {!error && coupons && coupons.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-muted">
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Value</th>
                <th className="px-4 py-2 font-medium">Expires</th>
                <th className="px-4 py-2 font-medium">Usage</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) =>
                editingId === coupon.id ? (
                  <tr key={coupon.id} className="border-b border-border last:border-0">
                    <td colSpan={7} className="px-4 py-3">
                      <form onSubmit={(e) => void handleEditSubmit(e, coupon.id)} noValidate className="flex flex-col gap-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <Input
                            id={`edit-value-${coupon.id}`}
                            label={coupon.type === CouponType.PERCENT ? 'Percent (0-100)' : 'Amount (₹)'}
                            value={editValue}
                            error={editFieldErrors.value}
                            onChange={(e) => setEditValue(e.target.value)}
                          />
                          <Input
                            id={`edit-usageLimit-${coupon.id}`}
                            label="Usage limit (blank = unlimited)"
                            type="number"
                            min={1}
                            value={editUsageLimit}
                            error={editFieldErrors.usageLimit}
                            onChange={(e) => setEditUsageLimit(e.target.value)}
                          />
                          <Input
                            id={`edit-expiresAt-${coupon.id}`}
                            label="Expires on"
                            type="date"
                            value={editExpiresAt}
                            error={editFieldErrors.expiresAt}
                            onChange={(e) => setEditExpiresAt(e.target.value)}
                          />
                        </div>
                        {editServerError && (
                          <p role="alert" className="text-sm text-danger">
                            {editServerError}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Button type="submit" loading={editSaving}>
                            Save
                          </Button>
                          <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={coupon.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-medium text-ink">{coupon.code}</td>
                    <td className="px-4 py-2 text-ink-muted">{coupon.type === CouponType.PERCENT ? 'Percent' : 'Fixed'}</td>
                    <td className="px-4 py-2 text-ink-muted">
                      {coupon.type === CouponType.PERCENT ? `${Number(coupon.value)}%` : inr.format(Number(coupon.value))}
                    </td>
                    <td className="px-4 py-2 text-ink-muted">{new Date(coupon.expiresAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-ink-muted">
                      {coupon.timesUsed}
                      {coupon.usageLimit !== null ? ` / ${coupon.usageLimit}` : ''}
                    </td>
                    <td className="px-4 py-2 text-ink-muted">{coupon.active ? 'Active' : 'Inactive'}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => startEdit(coupon)}>
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          loading={actingId === coupon.id}
                          onClick={() => void handleToggleActive(coupon)}
                        >
                          {coupon.active ? 'Deactivate' : 'Activate'}
                        </Button>
                        {coupon.timesUsed === 0 && (
                          <Button variant="secondary" loading={actingId === coupon.id} onClick={() => void handleDelete(coupon)}>
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
