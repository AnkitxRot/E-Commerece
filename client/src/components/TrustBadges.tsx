const BADGES = [
  {
    label: 'Fast delivery',
    description: 'Most orders ship within 24 hours',
    icon: (
      <path d="M3 7h11v7H3zM14 10h4l3 3v1h-7zM6 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z" />
    ),
  },
  {
    label: 'Secure checkout',
    description: 'Your details are always protected',
    icon: <path d="M12 2l7 3v6c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V5z" />,
  },
  {
    label: 'Easy returns',
    description: '7-day no-questions-asked returns',
    icon: <path d="M4 4v6h6M4.5 15a8 8 0 108-11.6L4 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  },
];

export function TrustBadges() {
  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      {BADGES.map((badge) => (
        <li key={badge.label} className="flex items-start gap-3">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-6 w-6 shrink-0 text-accent" fill="currentColor" aria-hidden="true">
            {badge.icon}
          </svg>
          <div>
            <p className="font-medium text-ink">{badge.label}</p>
            <p className="text-sm text-ink-muted">{badge.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
