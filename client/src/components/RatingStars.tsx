function Star({ fill }: { fill: number }) {
  const id = `star-clip-${Math.round(fill * 100)}`;
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <rect x="0" y="0" width={20 * fill} height="20" />
        </clipPath>
      </defs>
      <path
        d="M10 1.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        className="text-border"
      />
      <g clipPath={`url(#${id})`}>
        <path
          d="M10 1.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"
          fill="currentColor"
          className="text-accent"
        />
      </g>
    </svg>
  );
}

export function RatingStars({ rating, reviewCount, size = 'sm' }: { rating: number; reviewCount: number; size?: 'sm' | 'md' }) {
  if (reviewCount === 0) {
    return <p className="text-sm text-ink-muted">No reviews yet</p>;
  }
  const stars = [0, 1, 2, 3, 4].map((i) => Math.max(0, Math.min(1, rating - i)));
  return (
    <div className={`flex items-center gap-1.5 ${size === 'md' ? 'text-base' : 'text-sm'}`}>
      <span className="flex items-center gap-0.5" role="img" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
        {stars.map((fill, i) => (
          <Star key={i} fill={fill} />
        ))}
      </span>
      <span className="text-ink-muted">
        {rating.toFixed(1)} · {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
      </span>
    </div>
  );
}
