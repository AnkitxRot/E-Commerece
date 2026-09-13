const RATINGS = [1, 2, 3, 4, 5];

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-6 w-6" aria-hidden="true">
      <path
        d="M10 1.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1"
        className={filled ? 'text-accent' : 'text-border'}
      />
    </svg>
  );
}

export function RatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  function move(delta: number) {
    const current = value ?? 0;
    const next = Math.min(5, Math.max(1, current + delta));
    onChange(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Rate this product"
      className="flex items-center gap-1"
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          move(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      {RATINGS.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} of 5 stars`}
          tabIndex={value === n || (value === null && n === 1) ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(n)}
          className="rounded-sm p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        >
          <StarIcon filled={value !== null && n <= value} />
        </button>
      ))}
      <span className="ml-2 text-sm text-ink-muted">{value ? `${value} of 5` : 'Not rated'}</span>
    </div>
  );
}
