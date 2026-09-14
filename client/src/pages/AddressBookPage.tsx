import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  addressListResponseSchema,
  addressResponseSchema,
  createAddressInputSchema,
  updateAddressInputSchema,
  type AddressDto,
} from '@audio-commerce/shared';
import { ApiError, apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';
import { useToast } from '../context/ToastContext.js';
import { Button } from '../components/Button.js';
import { Input } from '../components/Input.js';
import { Breadcrumbs } from '../components/Breadcrumbs.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';

const EMPTY_FORM = { label: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: 'India', phone: '' };

export default function AddressBookPage() {
  const [addresses, setAddresses] = useState<AddressDto[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const { show } = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
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
          addressListResponseSchema,
          await apiFetch('/api/addresses', { signal: ac.signal }),
        );
        if (!cancelled) setAddresses(result.addresses);
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

  function toPayload(f: typeof EMPTY_FORM) {
    return { ...f, line2: f.line2.trim() || undefined };
  }

  async function handleCreateSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setServerError(null);

    const result = createAddressInputSchema.safeParse({ ...toPayload(form), isDefault: formIsDefault || undefined });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) errors[issue.path.join('.') || 'form'] = issue.message;
      setFieldErrors(errors);
      return;
    }

    setCreating(true);
    try {
      const data = await apiFetch('/api/addresses', { method: 'POST', body: JSON.stringify(result.data) });
      const created = parseCatalog(addressResponseSchema, data).address;
      setAddresses((prev) => {
        const next = created.isDefault ? (prev ?? []).map((a) => ({ ...a, isDefault: false })) : (prev ?? []);
        return [created, ...next];
      });
      setForm(EMPTY_FORM);
      setFormIsDefault(false);
      show('Address added', 'success');
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Unable to save this address right now.');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(address: AddressDto) {
    setEditingId(address.id);
    setEditForm({
      label: address.label,
      line1: address.line1,
      line2: address.line2 ?? '',
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone,
    });
    setEditFieldErrors({});
    setEditServerError(null);
  }

  async function handleEditSubmit(event: FormEvent, id: string) {
    event.preventDefault();
    setEditFieldErrors({});
    setEditServerError(null);

    const result = updateAddressInputSchema.safeParse(toPayload(editForm));
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) errors[issue.path.join('.') || 'form'] = issue.message;
      setEditFieldErrors(errors);
      return;
    }

    setEditSaving(true);
    try {
      const data = await apiFetch(`/api/addresses/${id}`, { method: 'PATCH', body: JSON.stringify(result.data) });
      const updated = parseCatalog(addressResponseSchema, data).address;
      setAddresses((prev) => (prev ? prev.map((a) => (a.id === id ? updated : a)) : prev));
      setEditingId(null);
      show('Address updated', 'success');
    } catch (err) {
      setEditServerError(err instanceof ApiError ? err.message : 'Unable to save this address right now.');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleSetDefault(address: AddressDto) {
    setActingId(address.id);
    try {
      const data = await apiFetch(`/api/addresses/${address.id}/default`, { method: 'POST' });
      const updated = parseCatalog(addressResponseSchema, data).address;
      setAddresses((prev) =>
        prev ? prev.map((a) => (a.id === updated.id ? updated : { ...a, isDefault: false })) : prev,
      );
      show('Default address updated', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not update the default address', 'error');
    } finally {
      setActingId(null);
    }
  }

  async function handleDelete(address: AddressDto) {
    if (!window.confirm(`Delete the "${address.label}" address? This can't be undone.`)) return;
    setActingId(address.id);
    try {
      await apiFetch(`/api/addresses/${address.id}`, { method: 'DELETE' });
      setAddresses((prev) => (prev ? prev.filter((a) => a.id !== address.id) : prev));
      show('Address deleted', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not delete this address', 'error');
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <Breadcrumbs items={[{ label: 'Account', href: '/account' }, { label: 'Addresses' }]} />
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">Your addresses</h1>

      <form onSubmit={handleCreateSubmit} noValidate className="mb-8 flex flex-col gap-4 rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-ink">Add a new address</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="label" label="Label (e.g. Home, Work)" value={form.label} error={fieldErrors.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
          <Input id="phone" label="Phone" type="tel" value={form.phone} error={fieldErrors.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <Input id="line1" label="Address line 1" value={form.line1} error={fieldErrors.line1} onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))} />
        <Input id="line2" label="Address line 2 (optional)" value={form.line2} error={fieldErrors.line2} onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="city" label="City" value={form.city} error={fieldErrors.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          <Input id="state" label="State" value={form.state} error={fieldErrors.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="postalCode" label="Postal code" value={form.postalCode} error={fieldErrors.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} />
          <Input id="country" label="Country" value={form.country} error={fieldErrors.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={formIsDefault} onChange={(e) => setFormIsDefault(e.target.checked)} className="h-4 w-4" />
          Make this my default address
        </label>
        {serverError && (
          <p role="alert" className="text-sm text-danger">
            {serverError}
          </p>
        )}
        <Button type="submit" loading={creating} className="self-start">
          Add address
        </Button>
      </form>

      {error && (
        <ErrorState title="Unable to load your addresses" description={error.message} onRetry={() => setRetryKey((k) => k + 1)} />
      )}

      {!error && !addresses && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      )}

      {!error && addresses && addresses.length === 0 && (
        <EmptyState
          title="No saved addresses yet"
          description="Add one above to speed up checkout next time."
          action={
            <Link to="/checkout" className="text-sm text-ink underline">
              Back to checkout
            </Link>
          }
        />
      )}

      {!error && addresses && addresses.length > 0 && (
        <ul className="flex flex-col gap-4">
          {addresses.map((address) =>
            editingId === address.id ? (
              <li key={address.id} className="rounded-lg border border-border p-4">
                <form onSubmit={(e) => void handleEditSubmit(e, address.id)} noValidate className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input id={`edit-label-${address.id}`} label="Label" value={editForm.label} error={editFieldErrors.label} onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))} />
                    <Input id={`edit-phone-${address.id}`} label="Phone" type="tel" value={editForm.phone} error={editFieldErrors.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <Input id={`edit-line1-${address.id}`} label="Address line 1" value={editForm.line1} error={editFieldErrors.line1} onChange={(e) => setEditForm((f) => ({ ...f, line1: e.target.value }))} />
                  <Input id={`edit-line2-${address.id}`} label="Address line 2" value={editForm.line2} error={editFieldErrors.line2} onChange={(e) => setEditForm((f) => ({ ...f, line2: e.target.value }))} />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input id={`edit-city-${address.id}`} label="City" value={editForm.city} error={editFieldErrors.city} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} />
                    <Input id={`edit-state-${address.id}`} label="State" value={editForm.state} error={editFieldErrors.state} onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input id={`edit-postalCode-${address.id}`} label="Postal code" value={editForm.postalCode} error={editFieldErrors.postalCode} onChange={(e) => setEditForm((f) => ({ ...f, postalCode: e.target.value }))} />
                    <Input id={`edit-country-${address.id}`} label="Country" value={editForm.country} error={editFieldErrors.country} onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))} />
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
              </li>
            ) : (
              <li key={address.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">
                      {address.label}
                      {address.isDefault && (
                        <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs text-ink-muted">
                          Default
                        </span>
                      )}
                    </p>
                    <address className="mt-1 not-italic text-sm text-ink-muted">
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ''}
                      <br />
                      {address.city}, {address.state} {address.postalCode}
                      <br />
                      {address.country}
                      <br />
                      {address.phone}
                    </address>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => startEdit(address)}>
                    Edit
                  </Button>
                  {!address.isDefault && (
                    <Button variant="secondary" loading={actingId === address.id} onClick={() => void handleSetDefault(address)}>
                      Set as default
                    </Button>
                  )}
                  <Button variant="secondary" loading={actingId === address.id} onClick={() => void handleDelete(address)}>
                    Delete
                  </Button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
