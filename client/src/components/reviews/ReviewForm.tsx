import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { reviewResponseSchema } from '@audio-commerce/shared';
import { ApiError, apiFetch } from '../../lib/apiClient.js';
import { parseCatalog } from '../../lib/parseCatalog.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Button } from '../Button.js';
import { RatingInput } from './RatingInput.js';

type Phase = 'form' | 'submitted' | 'already-reviewed';

export function ReviewForm({ productSlug }: { productSlug: string }) {
  const { user } = useAuth();
  const { show } = useToast();
  const [rating, setRating] = useState<number | null>(null);
  const [body, setBody] = useState('');
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');

  if (!user) {
    return (
      <p className="text-sm text-ink-muted">
        <Link to="/login" className="underline">
          Log in
        </Link>{' '}
        to write a review.
      </p>
    );
  }

  if (phase === 'submitted') {
    return <p className="text-sm text-ink">Thanks — your review is awaiting approval.</p>;
  }

  if (phase === 'already-reviewed') {
    return <p className="text-sm text-ink-muted">You have already reviewed this product.</p>;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setRatingError(null);
    setBodyError(null);

    let hasError = false;
    if (!rating) {
      setRatingError('Select a rating.');
      hasError = true;
    }
    const trimmed = body.trim();
    if (trimmed.length === 0) {
      setBodyError('Write a review before submitting.');
      hasError = true;
    } else if (trimmed.length > 2000) {
      setBodyError('Reviews must be 2000 characters or fewer.');
      hasError = true;
    }
    if (hasError) return;

    setSubmitting(true);
    try {
      parseCatalog(
        reviewResponseSchema,
        await apiFetch(`/api/products/${productSlug}/reviews`, {
          method: 'POST',
          body: JSON.stringify({ rating, body: trimmed }),
        }),
      );
      setPhase('submitted');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setPhase('already-reviewed');
      } else {
        show(err instanceof ApiError ? err.message : 'Could not submit your review', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <span id="rating-label" className="text-sm font-medium text-ink">
          Your rating
        </span>
        <div aria-describedby={ratingError ? 'rating-error' : undefined}>
          <RatingInput value={rating} onChange={setRating} disabled={submitting} />
        </div>
        {ratingError && (
          <p id="rating-error" role="alert" className="text-sm text-danger">
            {ratingError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="review-body" className="text-sm font-medium text-ink">
          Your review
        </label>
        <textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={submitting}
          rows={4}
          maxLength={2000}
          aria-invalid={Boolean(bodyError)}
          aria-describedby={bodyError ? 'review-body-error' : undefined}
          className="rounded-sm border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
        />
        {bodyError && (
          <p id="review-body-error" role="alert" className="text-sm text-danger">
            {bodyError}
          </p>
        )}
      </div>

      <div>
        <Button type="submit" loading={submitting}>
          Submit review
        </Button>
      </div>
    </form>
  );
}
