const DEFAULTS: Record<string, string> = {
  sort: 'newest',
  page: '1',
  pageSize: '24',
};

export function writeListParams(
  current: URLSearchParams,
  patch: Record<string, string | undefined>,
  mode: 'filter' | 'page',
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === '') next.delete(key);
    else next.set(key, value);
  }
  if (mode === 'filter') next.delete('page');
  for (const [key, fallback] of Object.entries(DEFAULTS)) {
    if (next.get(key) === fallback) next.delete(key);
  }
  return next;
}
