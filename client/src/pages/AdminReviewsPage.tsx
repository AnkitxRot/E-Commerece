import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ReviewStatus,
  adminReviewListResponseSchema,
  adminReviewResponseSchema,
  type AdminReviewListResponse,
} from '@audio-commerce/shared';
import { ApiError, apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';
import { useToast } from '../context/ToastContext.js';
import { Button } from '../components/Button.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';

const PAGE_SIZE = 20;
const STATUS_OPTIONS = Object.values(ReviewStatus);

export default function AdminReviewsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');
  const status = searchParams.get('status') ?? ReviewStatus.PENDING;
  const [data, setData] = useState<AdminReviewListResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [actingId, setActingId] = useState<string | null>(null);
  const { show } = useToast();

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function load() {
      setError(null);
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (status) params.set('status', status);
      try {
        const result = parseCatalog(
          adminReviewListResponseSchema,
          await apiFetch(`/api/admin/reviews?${params.toString()}`, { signal: ac.signal }),
        );
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error('Request failed'));
      }
    }

    void load();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [page, status, retryKey]);

  function updateParam(key: string, value: string, resetPage = true) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (resetPage) next.delete('page');
    setSearchParams(next);
  }

  async function moderate(id: string, nextStatus: 'APPROVED' | 'REJECTED') {
    setActingId(id);
    try {
      await parseCatalog(
        adminReviewResponseSchema,
        await apiFetch(`/api/admin/reviews/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus }),
        }),
      );
      show(nextStatus === 'APPROVED' ? 'Review approved' : 'Review rejected', 'success');
      setData((prev) => (prev ? { ...prev, items: prev.items.filter((r) => r.id !== id) } : prev));
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not update this review', 'error');
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">Reviews</h1>

      <div className="flex flex-col gap-1 sm:w-64">
        <label htmlFor="status" className="text-sm font-medium text-ink">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => updateParam('status', e.target.value)}
          className="rounded-sm border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <ErrorState
          title="Unable to load reviews"
          description={error.message}
          onRetry={() => setRetryKey((key) => key + 1)}
        />
      )}

      {!error && !data && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {!error && data && data.items.length === 0 && (
        <EmptyState title="No reviews found" description="Try a different status filter." />
      )}

      {!error && data && data.items.length > 0 && (
        <>
          <ul className="flex flex-col gap-4">
            {data.items.map((review) => (
              <li key={review.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{review.product.name}</p>
                    <p className="text-xs text-ink-muted">
                      {review.reviewer.name} ({review.reviewer.email})
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      Rating: {review.rating} of 5 · Status: {review.status}
                    </p>
                  </div>
                  {review.status === ReviewStatus.PENDING ? (
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        loading={actingId === review.id}
                        aria-label={`Approve review by ${review.reviewer.name} for ${review.product.name}`}
                        onClick={() => void moderate(review.id, 'APPROVED')}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        loading={actingId === review.id}
                        aria-label={`Reject review by ${review.reviewer.name} for ${review.product.name}`}
                        onClick={() => void moderate(review.id, 'REJECTED')}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </div>
                <p className="mt-3 text-sm text-ink">{review.body}</p>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between text-sm text-ink-muted">
            <span>
              Page {data.meta.page} of {Math.max(1, data.meta.totalPages)} ({data.meta.total} total)
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => updateParam('page', String(page - 1), false)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={page >= data.meta.totalPages}
                onClick={() => updateParam('page', String(page + 1), false)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
