import { useEffect, useState, type FormEvent } from 'react';
import type { ZodError } from 'zod';
import {
  ContentBlockType,
  adminContentBlockListResponseSchema,
  adminContentBlockResponseSchema,
  adminStoreSettingsResponseSchema,
  createContentBlockInputSchema,
  updateContentBlockInputSchema,
  updateStoreSettingsInputSchema,
  type AdminContentBlockDto,
} from '@audio-commerce/shared';
import { ApiError, apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';
import { useToast } from '../context/ToastContext.js';
import { Button } from '../components/Button.js';
import { Input } from '../components/Input.js';
import { ErrorState } from '../components/ErrorState.js';
import { EmptyState } from '../components/EmptyState.js';
import { Skeleton } from '../components/Skeleton.js';

function collectFieldErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

const SETTINGS_FORM_EMPTY = {
  storeName: '',
  logoUrl: '',
  faviconUrl: '',
  contactEmail: '',
  contactPhone: '',
  twitter: '',
  instagram: '',
  facebook: '',
  youtube: '',
  heroTitle: '',
  heroSubtitle: '',
};

const NEW_BLOCK_EMPTY = {
  type: ContentBlockType.ANNOUNCEMENT as string,
  position: '0',
  message: '',
  title: '',
  productSlugs: '',
};

export default function AdminSettingsPage() {
  const { show } = useToast();

  const [settingsForm, setSettingsForm] = useState(SETTINGS_FORM_EMPTY);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState<Error | null>(null);
  const [settingsFieldErrors, setSettingsFieldErrors] = useState<Record<string, string>>({});
  const [settingsServerError, setSettingsServerError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const [blocks, setBlocks] = useState<AdminContentBlockDto[] | null>(null);
  const [blocksError, setBlocksError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [newBlock, setNewBlock] = useState(NEW_BLOCK_EMPTY);
  const [newBlockFieldErrors, setNewBlockFieldErrors] = useState<Record<string, string>>({});
  const [newBlockServerError, setNewBlockServerError] = useState<string | null>(null);
  const [creatingBlock, setCreatingBlock] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPayload, setEditPayload] = useState<Record<string, string>>({});
  const [editServerError, setEditServerError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    async function load() {
      setSettingsError(null);
      setBlocksError(null);
      try {
        const [settingsData, blocksData] = await Promise.all([
          apiFetch('/api/admin/settings', { signal: ac.signal }),
          apiFetch('/api/admin/content-blocks', { signal: ac.signal }),
        ]);
        const settings = parseCatalog(adminStoreSettingsResponseSchema, settingsData).settings;
        setSettingsForm({
          storeName: settings.storeName,
          logoUrl: settings.logoUrl ?? '',
          faviconUrl: settings.faviconUrl ?? '',
          contactEmail: settings.contactEmail,
          contactPhone: settings.contactPhone ?? '',
          twitter: settings.socialLinks.twitter ?? '',
          instagram: settings.socialLinks.instagram ?? '',
          facebook: settings.socialLinks.facebook ?? '',
          youtube: settings.socialLinks.youtube ?? '',
          heroTitle: settings.heroContent?.title ?? '',
          heroSubtitle: settings.heroContent?.subtitle ?? '',
        });
        setSettingsLoaded(true);
        setBlocks(parseCatalog(adminContentBlockListResponseSchema, blocksData).blocks);
      } catch (err) {
        if (err instanceof Error) {
          setSettingsError(err);
          setBlocksError(err);
        }
      }
    }
    void load();
    return () => ac.abort();
  }, [retryKey]);

  async function handleSettingsSubmit(event: FormEvent) {
    event.preventDefault();
    setSettingsFieldErrors({});
    setSettingsServerError(null);

    const socialLinks = {
      twitter: settingsForm.twitter.trim() || undefined,
      instagram: settingsForm.instagram.trim() || undefined,
      facebook: settingsForm.facebook.trim() || undefined,
      youtube: settingsForm.youtube.trim() || undefined,
    };
    const result = updateStoreSettingsInputSchema.safeParse({
      storeName: settingsForm.storeName,
      logoUrl: settingsForm.logoUrl.trim() || null,
      faviconUrl: settingsForm.faviconUrl.trim() || null,
      contactEmail: settingsForm.contactEmail,
      contactPhone: settingsForm.contactPhone.trim() || null,
      socialLinks,
      heroContent: settingsForm.heroTitle.trim()
        ? { title: settingsForm.heroTitle.trim(), subtitle: settingsForm.heroSubtitle.trim() || undefined }
        : undefined,
    });
    if (!result.success) {
      setSettingsFieldErrors(collectFieldErrors(result.error));
      return;
    }

    setSavingSettings(true);
    try {
      await apiFetch('/api/admin/settings', { method: 'PATCH', body: JSON.stringify(result.data) });
      show('Settings saved', 'success');
    } catch (err) {
      setSettingsServerError(err instanceof ApiError ? err.message : 'Unable to save settings right now.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleCreateBlock(event: FormEvent) {
    event.preventDefault();
    setNewBlockFieldErrors({});
    setNewBlockServerError(null);

    const payload =
      newBlock.type === ContentBlockType.ANNOUNCEMENT
        ? { message: newBlock.message }
        : newBlock.type === ContentBlockType.BANNER
          ? { title: newBlock.title }
          : {
              title: newBlock.title,
              productSlugs: newBlock.productSlugs
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            };

    const result = createContentBlockInputSchema.safeParse({
      type: newBlock.type,
      payload,
      position: Number(newBlock.position),
    });
    if (!result.success) {
      setNewBlockFieldErrors(collectFieldErrors(result.error));
      return;
    }

    setCreatingBlock(true);
    try {
      const data = await apiFetch('/api/admin/content-blocks', { method: 'POST', body: JSON.stringify(result.data) });
      const created = parseCatalog(adminContentBlockResponseSchema, data).block;
      setBlocks((prev) => (prev ? [...prev, created].sort((a, b) => a.position - b.position) : [created]));
      setNewBlock(NEW_BLOCK_EMPTY);
      show('Content block created', 'success');
    } catch (err) {
      setNewBlockServerError(err instanceof ApiError ? err.message : 'Unable to create this block right now.');
    } finally {
      setCreatingBlock(false);
    }
  }

  function startEdit(block: AdminContentBlockDto) {
    setEditingId(block.id);
    const payload = block.payload as Record<string, unknown>;
    setEditPayload({
      position: String(block.position),
      message: typeof payload.message === 'string' ? payload.message : '',
      title: typeof payload.title === 'string' ? payload.title : '',
      productSlugs: Array.isArray(payload.productSlugs) ? payload.productSlugs.join(', ') : '',
    });
    setEditServerError(null);
  }

  async function handleEditSubmit(event: FormEvent, block: AdminContentBlockDto) {
    event.preventDefault();
    setEditServerError(null);

    const payload =
      block.type === ContentBlockType.ANNOUNCEMENT
        ? { message: editPayload.message }
        : block.type === ContentBlockType.BANNER
          ? { title: editPayload.title }
          : {
              title: editPayload.title,
              productSlugs: editPayload.productSlugs
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            };

    const result = updateContentBlockInputSchema.safeParse({ payload, position: Number(editPayload.position) });
    if (!result.success) {
      setEditServerError(result.error.issues[0]?.message ?? 'Invalid values');
      return;
    }

    setEditSaving(true);
    try {
      const data = await apiFetch(`/api/admin/content-blocks/${block.id}`, {
        method: 'PATCH',
        body: JSON.stringify(result.data),
      });
      const updated = parseCatalog(adminContentBlockResponseSchema, data).block;
      setBlocks((prev) => (prev ? prev.map((b) => (b.id === block.id ? updated : b)).sort((a, b) => a.position - b.position) : prev));
      setEditingId(null);
      show('Content block updated', 'success');
    } catch (err) {
      setEditServerError(err instanceof ApiError ? err.message : 'Unable to save this block right now.');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleToggleActive(block: AdminContentBlockDto) {
    setActingId(block.id);
    try {
      const data = await apiFetch(`/api/admin/content-blocks/${block.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !block.active }),
      });
      const updated = parseCatalog(adminContentBlockResponseSchema, data).block;
      setBlocks((prev) => (prev ? prev.map((b) => (b.id === block.id ? updated : b)) : prev));
      show(updated.active ? 'Block activated' : 'Block deactivated', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not update this block', 'error');
    } finally {
      setActingId(null);
    }
  }

  async function handleDelete(block: AdminContentBlockDto) {
    if (!window.confirm(`Delete this ${block.type.toLowerCase()} block? This can't be undone.`)) return;
    setActingId(block.id);
    try {
      await apiFetch(`/api/admin/content-blocks/${block.id}`, { method: 'DELETE' });
      setBlocks((prev) => (prev ? prev.filter((b) => b.id !== block.id) : prev));
      show('Content block deleted', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not delete this block', 'error');
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-ink">Store settings</h1>

      {settingsError ? (
        <ErrorState title="Unable to load settings" description={settingsError.message} onRetry={() => setRetryKey((k) => k + 1)} />
      ) : !settingsLoaded ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <form onSubmit={handleSettingsSubmit} noValidate className="flex max-w-2xl flex-col gap-4 rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-ink">General</p>
          <Input id="storeName" label="Store name" value={settingsForm.storeName} error={settingsFieldErrors.storeName} onChange={(e) => setSettingsForm((f) => ({ ...f, storeName: e.target.value }))} />
          <Input id="contactEmail" label="Contact email" value={settingsForm.contactEmail} error={settingsFieldErrors.contactEmail} onChange={(e) => setSettingsForm((f) => ({ ...f, contactEmail: e.target.value }))} />
          <Input id="contactPhone" label="Contact phone (optional)" value={settingsForm.contactPhone} error={settingsFieldErrors.contactPhone} onChange={(e) => setSettingsForm((f) => ({ ...f, contactPhone: e.target.value }))} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input id="logoUrl" label="Logo URL (optional)" placeholder="https://…" value={settingsForm.logoUrl} error={settingsFieldErrors.logoUrl} onChange={(e) => setSettingsForm((f) => ({ ...f, logoUrl: e.target.value }))} />
            <Input id="faviconUrl" label="Favicon URL (optional)" placeholder="https://…" value={settingsForm.faviconUrl} error={settingsFieldErrors.faviconUrl} onChange={(e) => setSettingsForm((f) => ({ ...f, faviconUrl: e.target.value }))} />
          </div>

          <p className="mt-2 text-sm font-medium text-ink">Social links (optional)</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input id="twitter" label="Twitter/X" placeholder="https://…" value={settingsForm.twitter} error={settingsFieldErrors['socialLinks.twitter']} onChange={(e) => setSettingsForm((f) => ({ ...f, twitter: e.target.value }))} />
            <Input id="instagram" label="Instagram" placeholder="https://…" value={settingsForm.instagram} error={settingsFieldErrors['socialLinks.instagram']} onChange={(e) => setSettingsForm((f) => ({ ...f, instagram: e.target.value }))} />
            <Input id="facebook" label="Facebook" placeholder="https://…" value={settingsForm.facebook} error={settingsFieldErrors['socialLinks.facebook']} onChange={(e) => setSettingsForm((f) => ({ ...f, facebook: e.target.value }))} />
            <Input id="youtube" label="YouTube" placeholder="https://…" value={settingsForm.youtube} error={settingsFieldErrors['socialLinks.youtube']} onChange={(e) => setSettingsForm((f) => ({ ...f, youtube: e.target.value }))} />
          </div>

          <p className="mt-2 text-sm font-medium text-ink">Homepage hero (optional)</p>
          <Input id="heroTitle" label="Hero title" value={settingsForm.heroTitle} error={settingsFieldErrors['heroContent.title']} onChange={(e) => setSettingsForm((f) => ({ ...f, heroTitle: e.target.value }))} />
          <Input id="heroSubtitle" label="Hero subtitle" value={settingsForm.heroSubtitle} error={settingsFieldErrors['heroContent.subtitle']} onChange={(e) => setSettingsForm((f) => ({ ...f, heroSubtitle: e.target.value }))} />

          {settingsServerError && (
            <p role="alert" className="text-sm text-danger">
              {settingsServerError}
            </p>
          )}
          <Button type="submit" loading={savingSettings} className="self-start">
            Save settings
          </Button>
        </form>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold text-ink">Content blocks</h2>

        <form onSubmit={handleCreateBlock} noValidate className="mb-6 flex flex-col gap-4 rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-ink">Add a content block</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="blockType" className="text-sm font-medium text-ink">
                Type
              </label>
              <select
                id="blockType"
                value={newBlock.type}
                onChange={(e) => setNewBlock((f) => ({ ...f, type: e.target.value }))}
                className="rounded-sm border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value={ContentBlockType.ANNOUNCEMENT}>Announcement</option>
                <option value={ContentBlockType.BANNER}>Banner</option>
                <option value={ContentBlockType.FEATURED_COLLECTION}>Featured collection</option>
              </select>
            </div>
            <Input id="blockPosition" label="Position" type="number" min={0} value={newBlock.position} onChange={(e) => setNewBlock((f) => ({ ...f, position: e.target.value }))} />
          </div>
          {newBlock.type === ContentBlockType.ANNOUNCEMENT && (
            <Input id="blockMessage" label="Message" value={newBlock.message} error={newBlockFieldErrors['payload.message']} onChange={(e) => setNewBlock((f) => ({ ...f, message: e.target.value }))} />
          )}
          {newBlock.type === ContentBlockType.BANNER && (
            <Input id="blockTitle" label="Title" value={newBlock.title} error={newBlockFieldErrors['payload.title']} onChange={(e) => setNewBlock((f) => ({ ...f, title: e.target.value }))} />
          )}
          {newBlock.type === ContentBlockType.FEATURED_COLLECTION && (
            <>
              <Input id="blockCollectionTitle" label="Title" value={newBlock.title} error={newBlockFieldErrors['payload.title']} onChange={(e) => setNewBlock((f) => ({ ...f, title: e.target.value }))} />
              <Input id="blockSlugs" label="Product slugs (comma-separated)" value={newBlock.productSlugs} error={newBlockFieldErrors['payload.productSlugs']} onChange={(e) => setNewBlock((f) => ({ ...f, productSlugs: e.target.value }))} />
            </>
          )}
          {newBlockServerError && (
            <p role="alert" className="text-sm text-danger">
              {newBlockServerError}
            </p>
          )}
          <Button type="submit" loading={creatingBlock} className="self-start">
            Add block
          </Button>
        </form>

        {blocksError && (
          <ErrorState title="Unable to load content blocks" description={blocksError.message} onRetry={() => setRetryKey((k) => k + 1)} />
        )}
        {!blocksError && !blocks && <Skeleton className="h-32 w-full" />}
        {!blocksError && blocks && blocks.length === 0 && (
          <EmptyState title="No content blocks yet" description="Add one above to show it on the homepage." />
        )}
        {!blocksError && blocks && blocks.length > 0 && (
          <ul className="flex flex-col gap-3">
            {blocks.map((block) =>
              editingId === block.id ? (
                <li key={block.id} className="rounded-lg border border-border p-4">
                  <form onSubmit={(e) => void handleEditSubmit(e, block)} noValidate className="flex flex-col gap-3">
                    <Input id={`edit-position-${block.id}`} label="Position" type="number" min={0} value={editPayload.position} onChange={(e) => setEditPayload((p) => ({ ...p, position: e.target.value }))} />
                    {block.type === ContentBlockType.ANNOUNCEMENT && (
                      <Input id={`edit-message-${block.id}`} label="Message" value={editPayload.message} onChange={(e) => setEditPayload((p) => ({ ...p, message: e.target.value }))} />
                    )}
                    {block.type === ContentBlockType.BANNER && (
                      <Input id={`edit-title-${block.id}`} label="Title" value={editPayload.title} onChange={(e) => setEditPayload((p) => ({ ...p, title: e.target.value }))} />
                    )}
                    {block.type === ContentBlockType.FEATURED_COLLECTION && (
                      <>
                        <Input id={`edit-ftitle-${block.id}`} label="Title" value={editPayload.title} onChange={(e) => setEditPayload((p) => ({ ...p, title: e.target.value }))} />
                        <Input id={`edit-slugs-${block.id}`} label="Product slugs (comma-separated)" value={editPayload.productSlugs} onChange={(e) => setEditPayload((p) => ({ ...p, productSlugs: e.target.value }))} />
                      </>
                    )}
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
                <li key={block.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
                  <div>
                    <p className="font-medium text-ink">
                      {block.type}
                      <span className="ml-2 text-xs text-ink-muted">position {block.position}</span>
                      {!block.active && <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs text-ink-muted">Inactive</span>}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {typeof block.payload.message === 'string' && block.payload.message}
                      {typeof block.payload.title === 'string' && block.payload.title}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => startEdit(block)}>
                      Edit
                    </Button>
                    <Button variant="secondary" loading={actingId === block.id} onClick={() => void handleToggleActive(block)}>
                      {block.active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button variant="secondary" loading={actingId === block.id} onClick={() => void handleDelete(block)}>
                      Delete
                    </Button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
