import { useEffect, useState, type FormEvent } from 'react';
import {
  adminBrandListResponseSchema,
  adminBrandResponseSchema,
  createBrandInputSchema,
  updateBrandInputSchema,
  type AdminBrandDto,
} from '@audio-commerce/shared';
import { ApiError, apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';
import { useToast } from '../context/ToastContext.js';
import { Button } from '../components/Button.js';
import { Input } from '../components/Input.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AdminBrandsPage() {
  useDocumentTitle('Brands');
  const [brands, setBrands] = useState<AdminBrandDto[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const { show } = useToast();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
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
          adminBrandListResponseSchema,
          await apiFetch('/api/admin/brands', { signal: ac.signal }),
        );
        if (!cancelled) setBrands(result.brands);
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

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleCreateSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setServerError(null);

    const result = createBrandInputSchema.safeParse({
      slug,
      name,
      logoUrl: logoUrl.trim() || null,
    });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) errors[issue.path.join('.') || 'form'] = issue.message;
      setFieldErrors(errors);
      return;
    }

    setCreating(true);
    try {
      const data = await apiFetch('/api/admin/brands', { method: 'POST', body: JSON.stringify(result.data) });
      const created = parseCatalog(adminBrandResponseSchema, data).brand;
      setBrands((prev) => (prev ? [...prev, created].sort((a, b) => a.name.localeCompare(b.name)) : [created]));
      setName('');
      setSlug('');
      setSlugTouched(false);
      setLogoUrl('');
      show('Brand created', 'success');
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Unable to create this brand right now.');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(brand: AdminBrandDto) {
    setEditingId(brand.id);
    setEditName(brand.name);
    setEditSlug(brand.slug);
    setEditLogoUrl(brand.logoUrl ?? '');
    setEditFieldErrors({});
    setEditServerError(null);
  }

  async function handleEditSubmit(event: FormEvent, id: string) {
    event.preventDefault();
    setEditFieldErrors({});
    setEditServerError(null);

    const result = updateBrandInputSchema.safeParse({
      name: editName,
      slug: editSlug,
      logoUrl: editLogoUrl.trim() || null,
    });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) errors[issue.path.join('.') || 'form'] = issue.message;
      setEditFieldErrors(errors);
      return;
    }

    setEditSaving(true);
    try {
      const data = await apiFetch(`/api/admin/brands/${id}`, { method: 'PATCH', body: JSON.stringify(result.data) });
      const updated = parseCatalog(adminBrandResponseSchema, data).brand;
      setBrands((prev) => (prev ? prev.map((b) => (b.id === id ? updated : b)) : prev));
      setEditingId(null);
      show('Brand updated', 'success');
    } catch (err) {
      setEditServerError(err instanceof ApiError ? err.message : 'Unable to save this brand right now.');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleToggleActive(brand: AdminBrandDto) {
    setActingId(brand.id);
    try {
      const data = await apiFetch(`/api/admin/brands/${brand.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !brand.isActive }),
      });
      const updated = parseCatalog(adminBrandResponseSchema, data).brand;
      setBrands((prev) => (prev ? prev.map((b) => (b.id === brand.id ? updated : b)) : prev));
      show(updated.isActive ? 'Brand activated' : 'Brand deactivated', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not update this brand', 'error');
    } finally {
      setActingId(null);
    }
  }

  async function handleDelete(brand: AdminBrandDto) {
    setActingId(brand.id);
    try {
      await apiFetch(`/api/admin/brands/${brand.id}`, { method: 'DELETE' });
      setBrands((prev) => (prev ? prev.filter((b) => b.id !== brand.id) : prev));
      show('Brand deleted', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not delete this brand', 'error');
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">Brands</h1>

      <form onSubmit={handleCreateSubmit} noValidate className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-ink">New brand</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input id="name" label="Name" value={name} error={fieldErrors.name} onChange={(e) => handleNameChange(e.target.value)} />
          <Input
            id="slug"
            label="Slug"
            value={slug}
            error={fieldErrors.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
          />
          <Input
            id="logoUrl"
            label="Logo URL (optional)"
            value={logoUrl}
            error={fieldErrors.logoUrl}
            placeholder="https://…"
            onChange={(e) => setLogoUrl(e.target.value)}
          />
        </div>
        {serverError && (
          <p role="alert" className="text-sm text-danger">
            {serverError}
          </p>
        )}
        <Button type="submit" loading={creating} className="self-start">
          Create brand
        </Button>
      </form>

      {error && (
        <ErrorState
          title="Unable to load brands"
          description={error.message}
          onRetry={() => setRetryKey((key) => key + 1)}
        />
      )}

      {!error && !brands && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {!error && brands && brands.length === 0 && (
        <EmptyState title="No brands yet" description="Create your first brand above." />
      )}

      {!error && brands && brands.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-muted">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Slug</th>
                <th className="px-4 py-2 font-medium">Products</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {brands.map((brand) =>
                editingId === brand.id ? (
                  <tr key={brand.id} className="border-b border-border last:border-0">
                    <td colSpan={5} className="px-4 py-3">
                      <form onSubmit={(e) => void handleEditSubmit(e, brand.id)} noValidate className="flex flex-col gap-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <Input
                            id={`edit-name-${brand.id}`}
                            label="Name"
                            value={editName}
                            error={editFieldErrors.name}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                          <Input
                            id={`edit-slug-${brand.id}`}
                            label="Slug"
                            value={editSlug}
                            error={editFieldErrors.slug}
                            onChange={(e) => setEditSlug(e.target.value)}
                          />
                          <Input
                            id={`edit-logo-${brand.id}`}
                            label="Logo URL"
                            value={editLogoUrl}
                            error={editFieldErrors.logoUrl}
                            onChange={(e) => setEditLogoUrl(e.target.value)}
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
                  <tr key={brand.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-ink">{brand.name}</td>
                    <td className="px-4 py-2 text-ink-muted">{brand.slug}</td>
                    <td className="px-4 py-2 text-ink-muted">{brand.productCount}</td>
                    <td className="px-4 py-2 text-ink-muted">{brand.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => startEdit(brand)}>
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          loading={actingId === brand.id}
                          onClick={() => void handleToggleActive(brand)}
                        >
                          {brand.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        {brand.productCount === 0 && (
                          <Button variant="secondary" loading={actingId === brand.id} onClick={() => void handleDelete(brand)}>
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
