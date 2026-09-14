import { useEffect, useState, type FormEvent } from 'react';
import {
  adminCategoryListResponseSchema,
  adminCategoryResponseSchema,
  createCategoryInputSchema,
  updateCategoryInputSchema,
  type AdminCategoryDto,
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

export default function AdminCategoriesPage() {
  useDocumentTitle('Categories');
  const [categories, setCategories] = useState<AdminCategoryDto[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const { show } = useToast();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [parentId, setParentId] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editParentId, setEditParentId] = useState('');
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
          adminCategoryListResponseSchema,
          await apiFetch('/api/admin/categories', { signal: ac.signal }),
        );
        if (!cancelled) setCategories(result.categories);
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

    const result = createCategoryInputSchema.safeParse({
      slug,
      name,
      parentId: parentId || null,
    });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) errors[issue.path.join('.') || 'form'] = issue.message;
      setFieldErrors(errors);
      return;
    }

    setCreating(true);
    try {
      const data = await apiFetch('/api/admin/categories', { method: 'POST', body: JSON.stringify(result.data) });
      const created = parseCatalog(adminCategoryResponseSchema, data).category;
      setCategories((prev) => (prev ? [...prev, created].sort((a, b) => a.name.localeCompare(b.name)) : [created]));
      setName('');
      setSlug('');
      setSlugTouched(false);
      setParentId('');
      show('Category created', 'success');
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Unable to create this category right now.');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(category: AdminCategoryDto) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditSlug(category.slug);
    setEditParentId(category.parentId ?? '');
    setEditFieldErrors({});
    setEditServerError(null);
  }

  async function handleEditSubmit(event: FormEvent, id: string) {
    event.preventDefault();
    setEditFieldErrors({});
    setEditServerError(null);

    const result = updateCategoryInputSchema.safeParse({
      name: editName,
      slug: editSlug,
      parentId: editParentId || null,
    });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) errors[issue.path.join('.') || 'form'] = issue.message;
      setEditFieldErrors(errors);
      return;
    }

    setEditSaving(true);
    try {
      const data = await apiFetch(`/api/admin/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(result.data),
      });
      const updated = parseCatalog(adminCategoryResponseSchema, data).category;
      setCategories((prev) => (prev ? prev.map((c) => (c.id === id ? updated : c)) : prev));
      setEditingId(null);
      show('Category updated', 'success');
    } catch (err) {
      setEditServerError(err instanceof ApiError ? err.message : 'Unable to save this category right now.');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleToggleActive(category: AdminCategoryDto) {
    setActingId(category.id);
    try {
      const data = await apiFetch(`/api/admin/categories/${category.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !category.isActive }),
      });
      const updated = parseCatalog(adminCategoryResponseSchema, data).category;
      setCategories((prev) => (prev ? prev.map((c) => (c.id === category.id ? updated : c)) : prev));
      show(updated.isActive ? 'Category activated' : 'Category deactivated', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not update this category', 'error');
    } finally {
      setActingId(null);
    }
  }

  async function handleDelete(category: AdminCategoryDto) {
    setActingId(category.id);
    try {
      await apiFetch(`/api/admin/categories/${category.id}`, { method: 'DELETE' });
      setCategories((prev) => (prev ? prev.filter((c) => c.id !== category.id) : prev));
      show('Category deleted', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not delete this category', 'error');
    } finally {
      setActingId(null);
    }
  }

  const parentOptions = categories ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">Categories</h1>

      <form onSubmit={handleCreateSubmit} noValidate className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-ink">New category</p>
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
          <div className="flex flex-col gap-1">
            <label htmlFor="parentId" className="text-sm font-medium text-ink">
              Parent category (optional)
            </label>
            <select
              id="parentId"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="rounded-sm border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">None (top level)</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {serverError && (
          <p role="alert" className="text-sm text-danger">
            {serverError}
          </p>
        )}
        <Button type="submit" loading={creating} className="self-start">
          Create category
        </Button>
      </form>

      {error && (
        <ErrorState
          title="Unable to load categories"
          description={error.message}
          onRetry={() => setRetryKey((key) => key + 1)}
        />
      )}

      {!error && !categories && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {!error && categories && categories.length === 0 && (
        <EmptyState title="No categories yet" description="Create your first category above." />
      )}

      {!error && categories && categories.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-muted">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Slug</th>
                <th className="px-4 py-2 font-medium">Parent</th>
                <th className="px-4 py-2 font-medium">Products</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {categories.map((category) =>
                editingId === category.id ? (
                  <tr key={category.id} className="border-b border-border last:border-0">
                    <td colSpan={6} className="px-4 py-3">
                      <form
                        onSubmit={(e) => void handleEditSubmit(e, category.id)}
                        noValidate
                        className="flex flex-col gap-3"
                      >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <Input
                            id={`edit-name-${category.id}`}
                            label="Name"
                            value={editName}
                            error={editFieldErrors.name}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                          <Input
                            id={`edit-slug-${category.id}`}
                            label="Slug"
                            value={editSlug}
                            error={editFieldErrors.slug}
                            onChange={(e) => setEditSlug(e.target.value)}
                          />
                          <div className="flex flex-col gap-1">
                            <label htmlFor={`edit-parent-${category.id}`} className="text-sm font-medium text-ink">
                              Parent category
                            </label>
                            <select
                              id={`edit-parent-${category.id}`}
                              value={editParentId}
                              onChange={(e) => setEditParentId(e.target.value)}
                              className="rounded-sm border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                            >
                              <option value="">None (top level)</option>
                              {parentOptions
                                .filter((c) => c.id !== category.id)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                            </select>
                          </div>
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
                  <tr key={category.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-ink">{category.name}</td>
                    <td className="px-4 py-2 text-ink-muted">{category.slug}</td>
                    <td className="px-4 py-2 text-ink-muted">{category.parentName ?? '—'}</td>
                    <td className="px-4 py-2 text-ink-muted">{category.productCount}</td>
                    <td className="px-4 py-2 text-ink-muted">{category.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => startEdit(category)}>
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          loading={actingId === category.id}
                          onClick={() => void handleToggleActive(category)}
                        >
                          {category.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        {category.productCount === 0 && category.childCount === 0 && (
                          <Button
                            variant="secondary"
                            loading={actingId === category.id}
                            onClick={() => void handleDelete(category)}
                          >
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
