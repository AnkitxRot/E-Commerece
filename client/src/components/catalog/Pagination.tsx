function pageWindow(page: number, totalPages: number): number[] {
  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  for (let n = page - 2; n <= page + 2; n += 1) {
    if (n >= 1 && n <= totalPages) pages.add(n);
  }
  return [...pages].sort((a, b) => a - b);
}

const chip =
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-border bg-surface px-3 text-sm text-ink duration-snap focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none';

export function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={chip}
        disabled={prevDisabled}
        aria-disabled={prevDisabled}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      {pageWindow(page, totalPages).map((n) => (
        <button
          type="button"
          key={n}
          className={chip}
          aria-current={n === page ? 'page' : undefined}
          onClick={() => onPage(n)}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        className={chip}
        disabled={nextDisabled}
        aria-disabled={nextDisabled}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
